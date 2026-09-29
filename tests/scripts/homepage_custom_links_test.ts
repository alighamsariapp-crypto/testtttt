import assert from 'node:assert/strict';
import { openHomepageCustomUrl } from '../../src/utils/homepageLinks';

const assignedUrls: string[] = [];
const openedUrls: Array<{ url: string; target: string; features: string }> = [];

Object.defineProperty(globalThis, 'window', {
  value: {
    location: {
      assign: (url: string) => assignedUrls.push(url),
    },
    open: (url: string, target: string, features: string) => openedUrls.push({ url, target, features }),
  },
  configurable: true,
});

assert.equal(openHomepageCustomUrl('/contact'), true, 'مسیر داخلی تک‌اسلش باید پذیرفته شود');
assert.deepEqual(assignedUrls, ['/contact']);
assert.equal(openedUrls.length, 0);

assert.equal(openHomepageCustomUrl('https://example.com/landing'), true, 'URL امن HTTPS باید پذیرفته شود');
assert.deepEqual(openedUrls, [{
  url: 'https://example.com/landing',
  target: '_blank',
  features: 'noopener,noreferrer',
}]);

assert.equal(openHomepageCustomUrl('mailto:support@example.com'), true, 'لینک mailto باید پذیرفته شود');
assert.equal(openHomepageCustomUrl('tel:+989121234567'), true, 'لینک tel باید پذیرفته شود');
assert.deepEqual(assignedUrls, ['/contact', 'mailto:support@example.com', 'tel:+989121234567']);

const operationsBeforeRejectedValues = assignedUrls.length + openedUrls.length;
for (const rejectedUrl of ['//evil.example', 'javascript:alert(1)', 'data:text/html,unsafe', 'ftp://example.com', 'contact']) {
  assert.equal(openHomepageCustomUrl(rejectedUrl), false, `لینک غیرمجاز باید رد شود: ${rejectedUrl}`);
}
assert.equal(assignedUrls.length + openedUrls.length, operationsBeforeRejectedValues, 'لینک ردشده نباید مسیر یا پنجره‌ای باز کند');

console.log('✓ رفتار امن لینک‌های دلخواه صفحهٔ اصلی تأیید شد');
