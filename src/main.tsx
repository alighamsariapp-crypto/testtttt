import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { validateEnvironment } from './config/env';

// Fail-closed assertion on frontend startup: Refuse to boot if production security rules are violated.
try {
  validateEnvironment(true);
} catch (envError) {
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#f8fafc;font-family:system-ui,sans-serif;padding:24px;text-align:center;" dir="rtl">
        <div style="max-width:520px;background:#1e293b;border:1px solid #ef4444;border-radius:16px;padding:32px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
          <h1 style="color:#ef4444;font-size:18px;font-weight:bold;margin-bottom:12px;">خطای امنیتی پیکربندی سیستم (Fail-Closed)</h1>
          <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin-bottom:16px;">
            حالت نمایشی (Demo Mode) یا درگاه‌های آزمایشی در محیط انتشار مجاز نیستند و اجرای سامانه برای پیشگیری از نشت اطلاعات متوقف گردید.
          </p>
          <div style="background:#0f172a;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;color:#fca5a5;text-align:left;direction:ltr;overflow-x:auto;">
            ${(envError instanceof Error ? envError.message : String(envError)).replace(/\n/g, '<br/>')}
          </div>
        </div>
      </div>
    `;
  }
  throw envError;
}

// A browser can restore a complete prior SPA snapshot from bfcache without
// requesting the server again. Reload only in that case so a deployed frontend
// version is revalidated while normal in-app navigation remains unaffected.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

