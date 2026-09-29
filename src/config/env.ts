export type AppEnvironment = 'development' | 'staging' | 'production';

/**
 * Resolves the active application environment.
 * Default is 'production' if building/running in production or if unspecified.
 */
export function getAppEnvironment(): AppEnvironment {
  const envVal = (import.meta.env?.VITE_APP_ENV as string | undefined)?.trim().toLowerCase();
  if (envVal === 'development' || envVal === 'staging' || envVal === 'production') {
    return envVal;
  }
  if (import.meta.env?.PROD || import.meta.env?.MODE === 'production') {
    return 'production';
  }
  return 'development';
}

export interface EnvOverride {
  env?: string;
  demoMode?: boolean;
  zibalSandbox?: boolean;
}

/**
 * Validates the runtime configuration against fail-closed production security rules.
 * Throws a descriptive Error and returns the list of violations if invalid.
 */
export function validateEnvironment(
  throwOnFail = true,
  overrides?: EnvOverride
): { valid: boolean; violations: string[]; isDemoMode: boolean; isProduction: boolean } {
  const violations: string[] = [];
  const appEnv = overrides?.env ?? getAppEnvironment();
  const isProd = appEnv === 'production' || (overrides?.env === undefined && (import.meta.env?.PROD || import.meta.env?.MODE === 'production'));
  const rawDemoMode = overrides?.demoMode !== undefined ? overrides.demoMode : (import.meta.env?.VITE_ENABLE_DEMO_MODE === 'true');

  if (isProd && rawDemoMode) {
    violations.push('VITE_ENABLE_DEMO_MODE=true is strictly forbidden in production. Production must be fail-closed.');
  }

  if (appEnv !== 'development' && rawDemoMode) {
    violations.push(`VITE_ENABLE_DEMO_MODE=true is forbidden in '${appEnv}'. Demo mode is only permitted when VITE_APP_ENV=development.`);
  }

  // Check client-exposed test payment gateways
  const rawZibalSandbox = overrides?.zibalSandbox !== undefined
    ? overrides.zibalSandbox
    : ((import.meta.env as any)?.VITE_ZIBAL_SANDBOX === 'true' || (import.meta.env as any)?.ZIBAL_SANDBOX === 'true');
  if (isProd && rawZibalSandbox) {
    violations.push('Sandbox payment gateways (ZIBAL_SANDBOX=true) are strictly forbidden in production.');
  }

  const valid = violations.length === 0;
  if (!valid && throwOnFail) {
    const errorMsg = `[SECURITY FATAL] Fail-Closed Environment Policy Violation:\n${violations.map((v) => `  * ${v}`).join('\n')}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const computedDemoMode = (appEnv === 'development') && rawDemoMode;

  return { valid, violations, isDemoMode: computedDemoMode, isProduction: isProd };
}

export const APP_ENV: AppEnvironment = getAppEnvironment();
export const isProduction: boolean = APP_ENV === 'production' || import.meta.env?.PROD === true || import.meta.env?.MODE === 'production';

// Demo mode is ONLY allowed if explicitly enabled AND in development environment.
// In production or staging, isDemoMode is GUARANTEED false.
export const isDemoMode: boolean = (APP_ENV === 'development') && (import.meta.env?.VITE_ENABLE_DEMO_MODE === 'true');

export const API_BASE_URL: string = ((import.meta.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api/v1');
