import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appEnv = (env.VITE_APP_ENV || process.env.VITE_APP_ENV || (mode === 'production' ? 'production' : 'development')).trim().toLowerCase();
  const enableDemoMode = env.VITE_ENABLE_DEMO_MODE === 'true' || process.env.VITE_ENABLE_DEMO_MODE === 'true';
  const zibalSandbox = env.ZIBAL_SANDBOX === 'true' || process.env.ZIBAL_SANDBOX === 'true' || env.VITE_ZIBAL_SANDBOX === 'true';

  const isProduction = mode === 'production' || appEnv === 'production' || process.env.NODE_ENV === 'production';

  const violations: string[] = [];

  if (isProduction && enableDemoMode) {
    violations.push('VITE_ENABLE_DEMO_MODE=true is strictly forbidden in production builds (Fail-Closed Policy).');
  }
  if (appEnv !== 'development' && enableDemoMode) {
    violations.push(`VITE_ENABLE_DEMO_MODE=true cannot be enabled when VITE_APP_ENV='${appEnv}'. Demo mode is only permitted in development.`);
  }
  if (isProduction && zibalSandbox) {
    violations.push('ZIBAL_SANDBOX=true (Sandbox/test payment gateways are strictly forbidden in production builds).');
  }

  if (violations.length > 0) {
    console.error('\n================================================================================');
    console.error('[FATAL BUILD CONFIGURATION ERROR] Production security policy violation detected:');
    violations.forEach((v) => console.error(`  - ${v}`));
    console.error('Production builds MUST be fail-closed. Aborting build immediately.');
    console.error('================================================================================\n');
    throw new Error(`Production build aborted due to security configuration violations:\n${violations.join('\n')}`);
  }

  return {
    plugins: [react(), tailwindcss()],
    // The deployment assets already live in public/. Do not copy public/ onto
    // itself; generated files are written there while runtime files remain.
    publicDir: false,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Laravel/Apache serves the frontend from public/. Keep Laravel's
      // index.php, .htaccess and runtime directories intact while replacing
      // only generated Vite assets and the SPA entrypoint.
      outDir: 'public',
      emptyOutDir: false,
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
