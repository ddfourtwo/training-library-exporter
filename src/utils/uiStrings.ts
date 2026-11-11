/**
 * UI string constants
 *
 * Centralized strings for UI components to enable consistency and easier maintenance.
 * This also prepares the codebase for potential i18n/localization in the future.
 */

/**
 * Settings page strings
 */
export const SETTINGS_STRINGS = {
  TITLE: 'Settings',
  SUBTITLE: 'Manage connections',
  TRAINING_PEAKS_REQUIRED: 'TrainingPeaks (Required)',
  TRAINING_PEAKS_DESCRIPTION:
    'This connection is mandatory for loading workouts and training plans.',
} as const;

/**
 * Auth status display strings
 */
export const AUTH_STATUS_STRINGS = {
  CHECKING: 'Checking...',
  AUTHENTICATED: 'Authenticated',
  NOT_AUTHENTICATED: 'Not Authenticated',
  ERROR: 'Error',
  TOKEN_AGE_PREFIX: 'Token',
  TRAINING_PEAKS: {
    LABEL: 'TrainingPeaks',
    OPEN_TO_CAPTURE: 'Open TrainingPeaks to capture a token',
    REQUIRED_PREFIX: 'Required connection. ',
  },
} as const;

/**
 * Error boundary strings
 */
export const ERROR_BOUNDARY_STRINGS = {
  TITLE: 'Something went wrong',
  DEFAULT_MESSAGE: 'An unexpected error occurred.',
  TRY_AGAIN: 'Try again',
  SEND_REPORT: 'Copy diagnostic report',
  REPORT_COPIED: 'Report copied. Paste it into a new issue on the project page.',
  REPORT_COPY_FAILED: 'Could not copy the report. Select it below and copy it.',
  PRIVACY_NOTICE:
    'The report carries only version, browser and platform. Review it before pasting it anywhere public.',
} as const;

/**
 * Format token age for display
 * @param age - Token age in milliseconds
 * @returns Formatted string like "2h 30m ago" or "15m ago"
 */
export function formatTokenAge(age: number | null): string {
  if (age === null) return 'Unknown';
  const hours = Math.floor(age / (1000 * 60 * 60));
  const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  }
  return `${minutes}m ago`;
}

/**
 * Build provider status label
 * @param provider - Provider name
 * @param isLoading - Whether auth check is in progress
 * @param isAuthenticated - Whether provider is authenticated
 * @param error - Error message if any
 * @param userName - Optional user name for display
 */
export function buildProviderStatusLabel(
  provider: 'TrainingPeaks',
  isLoading: boolean,
  isAuthenticated: boolean,
  error: string | null,
  userName?: string
): string {
  if (isLoading) {
    return `${provider}: ${AUTH_STATUS_STRINGS.CHECKING}`;
  }
  if (error) {
    return `${provider}: ${AUTH_STATUS_STRINGS.ERROR}`;
  }
  if (isAuthenticated) {
    const displayName = userName?.trim() ?? AUTH_STATUS_STRINGS.AUTHENTICATED;
    return `${provider}: ${displayName}`;
  }
  return `${provider}: ${AUTH_STATUS_STRINGS.NOT_AUTHENTICATED}`;
}

/**
 * Status lines for the quiet auth refresh (temporary background tab).
 * Keyed by the background's outcome, plus the in-flight state.
 */
export const AUTH_REFRESH_MESSAGES = {
  trainingpeaks: {
    refreshing: 'Refreshing TrainingPeaks sign-in in a background tab…',
    refreshed: 'TrainingPeaks sign-in refreshed.',
    sign_in_required:
      'Sign in to TrainingPeaks in the tab we opened, then try again.',
    cancelled: 'The TrainingPeaks tab was closed before sign-in was captured.',
    error: 'Could not refresh TrainingPeaks sign-in',
  },
} as const;
