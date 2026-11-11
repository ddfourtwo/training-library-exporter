/**
 * Application constants
 *
 * Centralized configuration values
 */

/**
 * TrainingPeaks environment (production vs sandbox).
 * Switchable at runtime via the Settings panel; stored in chrome.storage.
 */
export type TrainingPeaksEnvironment = 'production' | 'sandbox';

export interface TrainingPeaksEnvironmentConfig {
  apiBaseUrl: string;
  appUrl: string;
}

export const TRAININGPEAKS_ENVIRONMENTS: Record<
  TrainingPeaksEnvironment,
  TrainingPeaksEnvironmentConfig
> = {
  production: {
    apiBaseUrl: 'https://tpapi.trainingpeaks.com',
    appUrl: 'https://app.trainingpeaks.com',
  },
  sandbox: {
    apiBaseUrl: 'https://tpapi.sandbox.trainingpeaks.com',
    appUrl: 'https://app.sandbox.trainingpeaks.com',
  },
};

export const DEFAULT_TRAININGPEAKS_ENVIRONMENT: TrainingPeaksEnvironment =
  'production';

export function isTrainingPeaksEnvironment(
  value: string | undefined
): value is TrainingPeaksEnvironment {
  return value === 'production' || value === 'sandbox';
}

const TRAININGPEAKS_ENVIRONMENT_NAMES: readonly TrainingPeaksEnvironment[] = [
  'production',
  'sandbox',
];

/**
 * Which TrainingPeaks environment serves the web app at `origin`, or null when
 * the origin is not a TrainingPeaks app origin. Exact match only, so a
 * lookalike such as `https://app.trainingpeaks.com.evil.test` is rejected.
 */
export function trainingPeaksEnvironmentForAppOrigin(
  origin: string | null | undefined
): TrainingPeaksEnvironment | null {
  if (!origin) {
    return null;
  }

  return (
    TRAININGPEAKS_ENVIRONMENT_NAMES.find(
      (environment) => TRAININGPEAKS_ENVIRONMENTS[environment].appUrl === origin
    ) ?? null
  );
}

/**
 * Which TrainingPeaks environment serves the API at `origin`, or null when the
 * origin is not a TrainingPeaks API origin. Exact match only.
 */
export function trainingPeaksEnvironmentForApiOrigin(
  origin: string | null | undefined
): TrainingPeaksEnvironment | null {
  if (!origin) {
    return null;
  }

  return (
    TRAININGPEAKS_ENVIRONMENT_NAMES.find(
      (environment) =>
        TRAININGPEAKS_ENVIRONMENTS[environment].apiBaseUrl === origin
    ) ?? null
  );
}

/**
 * TrainingPeaks API base URL (production default).
 * Prefer the environment-aware helpers in trainingPeaksConfigService for
 * runtime calls; this constant remains the production fallback.
 */
export const API_BASE_URL = TRAININGPEAKS_ENVIRONMENTS.production.apiBaseUrl;

/**
 * Build mode flags exposed by Vite.
 * Use these instead of guessing based on the current hostname.
 */
export const IS_DEVELOPMENT = import.meta.env.DEV;

/**
 * Resolve a URL to its origin, returning null for values that are not valid
 * absolute URLs. Used to derive an origin from `sender.tab.url`.
 */
export function originFromUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Token expiration threshold (24 hours in milliseconds)
 */
export const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Extension display name
 */
export const EXTENSION_NAME = 'Training Library Exporter';

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  TOKEN_TIMESTAMP: 'token_timestamp',
  TRAININGPEAKS_API_LOGS: 'trainingpeaks_api_logs',
  TRAININGPEAKS_ENVIRONMENT: 'trainingpeaks_environment',
} as const;

/**
 * Date range constants for training plan API endpoints
 * These dates represent the widest possible range supported by the API
 */
export const PLAN_DATE_RANGE = {
  START_DATE: '2010-12-15',
  END_DATE: '2038-09-13',
} as const;

/**
 * React Query cache durations (in milliseconds)
 * Controls how long data remains fresh before refetching
 */
export const CACHE_DURATIONS = {
  USER: 5 * 60 * 1000, // 5 minutes - user profile rarely changes
  LIBRARIES: 10 * 60 * 1000, // 10 minutes - library list is relatively static
  LIBRARY_ITEMS: 3 * 60 * 1000, // 3 minutes - library items may be edited
  TRAINING_PLANS: 10 * 60 * 1000, // 10 minutes - plan list rarely changes
  PLAN_WORKOUTS: 3 * 60 * 1000, // 3 minutes - workouts may be modified
  PLAN_NOTES: 3 * 60 * 1000, // 3 minutes - notes may be edited
  PLAN_EVENTS: 3 * 60 * 1000, // 3 minutes - events may change
} as const;

/**
 * Create headers for TrainingPeaks API requests
 *
 * Headers match exactly what TrainingPeaks web app sends for authentication.
 * Some headers (sec-*) are automatically added by the browser.
 *
 * @param token - Bearer token for authentication
 * @returns Headers object for fetch requests
 */
export function createApiHeaders(
  token: string,
  appOrigin: string = TRAININGPEAKS_ENVIRONMENTS.production.appUrl
): Record<string, string> {
  return {
    accept: 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    origin: appOrigin,
    referer: `${appOrigin}/`,
    // Note: sec-fetch-* headers are automatically added by Chrome
    // Note: user-agent is a forbidden header and cannot be set by extensions
  };
}
