import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const debugPort = 9232;
const profileDir = await mkdtemp(path.join(os.tmpdir(), 'novinet-axis-qa-'));
const appUrl = process.env.APP_URL || 'http://127.0.0.1:3022/admin?demo=1&tab=products';
const ownsPreview = !process.env.APP_URL;
let preview;
const chromium = spawn('chromium', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  'about:blank',
], { stdio: 'ignore' });

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (condition, label) => {
  const until = Date.now() + 20_000;
  while (Date.now() < until) {
    if (await condition()) return;
    await pause(120);
  }
  throw new Error(`زمان انتظار برای «${label}» تمام شد.`);
};

try {
  if (ownsPreview) {
    preview = spawn('pnpm', ['--ignore-workspace', 'run', 'dev'], {
      env: { ...process.env, PORT: '3022', NODE_ENV: 'production' },
      stdio: 'ignore',
    });
    await waitFor(async () => {
      try { return (await fetch(appUrl)).ok; } catch { return false; }
    }, 'آماده‌شدن preview production');
  }
  await waitFor(async () => {
    try { return (await fetch(`http://127.0.0.1:${debugPort}/json`)).ok; } catch { return false; }
  }, 'آماده‌شدن مرورگر');
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  const page = pages.find((entry) => entry.type === 'page');
  assert.ok(page?.webSocketDebuggerUrl, 'صفحهٔ آزمون مرورگر پیدا نشد.');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const diagnostics = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') diagnostics.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled') diagnostics.push(message.params.args.map((item) => item.value || item.description || '').join(' '));
    const resolver = pending.get(message.id);
    if (!resolver) return;
    pending.delete(message.id);
    if (message.error) resolver.reject(new Error(message.error.message));
    else resolver.resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await command('Runtime.enable');
  await command('Page.enable');
  const evaluate = async (expression) => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'خطای اجرای آزمون مرورگر');
    return result.result.value;
  };
  const waitForText = (text) => waitFor(() => evaluate(`document.body?.innerText.includes(${JSON.stringify(text)})`), text);
  const clickButton = (text) => evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === ${JSON.stringify(text)});
    if (!button) throw new Error(${JSON.stringify(`دکمهٔ ${text} پیدا نشد.`)});
    button.click();
  })()`);
  const setInput = (labelText, value) => evaluate(`(() => {
    const label = [...document.querySelectorAll('label')].find((item) => item.textContent?.trim().startsWith(${JSON.stringify(labelText)}));
    const input = label?.querySelector('input');
    if (!input) throw new Error(${JSON.stringify(`فیلد ${labelText} پیدا نشد.`)});
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setValue.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);

  await command('Page.navigate', { url: appUrl });
  await waitFor(() => evaluate('window.location.pathname === "/admin"'), 'انتقال به مسیر پنل');
  await waitFor(() => evaluate('document.readyState === "complete"'), 'بارگذاری مسیر پنل');
  await pause(1_500);
  const initialText = await evaluate('document.body?.innerText || ""');
  const pageDebug = await evaluate(`JSON.stringify({
    href: window.location.href,
    root: document.querySelector('#root')?.innerHTML.slice(0, 1200) || '',
    scripts: [...document.scripts].map((item) => item.src || item.textContent?.slice(0, 80)),
    resources: performance.getEntriesByType('resource').map((item) => item.name).filter((name) => name.includes('/src/') || name.includes('/node_modules/')).slice(-30),
  })`);
  assert.match(initialText, /ورود نمایشی مدیر/, `صفحهٔ ورود demo به‌جای انتظار نشان داده نشد: ${initialText.slice(0, 1200)}\nجزئیات صفحه: ${pageDebug}\nخطاهای مرورگر: ${diagnostics.join('\n').slice(0, 2500)}`);
  await clickButton('ورود نمایشی مدیر');
  await waitForText('افزودن کالا');
  await clickButton('افزودن کالا');
  await waitForText('مرحله ۱ از ۴');
  await setInput('نام کالا', 'لپ‌تاپ آزمون محور');
  await clickButton('مرحله بعد');
  await waitForText('مرحله ۲ از ۴');
  await setInput('قیمت اصلی', '12000000');
  await setInput('تعداد موجودی', '3');
  await clickButton('مرحله بعد');
  await waitForText('مرحله ۳ از ۴');
  await clickButton('مرحله بعد');
  await waitForText('تنظیم RAM و حافظهٔ دسته');
  await clickButton('تنظیم RAM و حافظهٔ دسته');
  await waitForText('تنظیم ویژگی‌های این دسته');
  await clickButton('RAM انتخابی');
  await clickButton('ذخیره ویژگی‌های دسته');
  await waitFor(() => evaluate(`[...document.querySelectorAll('button')].some((item) => item.textContent?.trim() === 'محور فروش')`), 'نمایش دکمهٔ محور فروش پس از ذخیره');
  await clickButton('محور فروش');
  await waitForText('16GB');
  await clickButton('16GB');
  await clickButton('به‌روزرسانی ترکیب‌ها');
  await waitForText('۱ ترکیب');
  await clickButton('ثبت کالا');
  await waitForText('کالا در دادهٔ نمایشی ثبت شد.');

  socket.close();
  console.log('Product axis quick-setup browser QA passed.');
} finally {
  chromium.kill('SIGTERM');
  await new Promise((resolve) => chromium.once('exit', resolve));
  await rm(profileDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 }).catch(() => undefined);
  if (preview && !preview.killed) preview.kill('SIGTERM');
}
