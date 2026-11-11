import type { ReactElement } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useTrainingPeaksEnvironment } from '@/hooks/useTrainingPeaksEnvironment';
import type { TrainingPeaksEnvironment } from '@/utils/constants';
import { useProviderAuthRefresh } from '@/hooks/useProviderAuthRefresh';
import {
  formatTokenAge,
  buildProviderStatusLabel,
  SETTINGS_STRINGS,
  AUTH_STATUS_STRINGS,
} from '@/utils/uiStrings';
import { AuthRow } from './shared/AuthRow';
import { ErrorBoundary } from './ErrorBoundary';
import { DebugLogPanel } from './DebugLogPanel';

interface SettingsPageProps {
  openLogs?: boolean;
}

function SettingsPageContent({
  openLogs = false,
}: SettingsPageProps): ReactElement {
  const {
    isAuthenticated: isTpAuthenticated,
    isLoading: isTpLoading,
    error: tpError,
    tokenAge: tpTokenAge,
    refreshAuth: refreshTpAuth,
  } = useAuth();
  const { data: user } = useUser({ enabled: isTpAuthenticated });

  const queryClient = useQueryClient();
  const {
    environment: tpEnvironment,
    setEnvironment: setTpEnvironment,
    isLoading: isTpEnvironmentLoading,
  } = useTrainingPeaksEnvironment();

  const handleTrainingPeaksEnvironmentChange = async (
    next: TrainingPeaksEnvironment
  ): Promise<void> => {
    if (next === tpEnvironment) return;
    await setTpEnvironment(next);
    // The stored token and cached data belong to the previous environment;
    // refetch everything against the newly selected TrainingPeaks API.
    await queryClient.invalidateQueries();
    await refreshTpAuth();
  };

  const tpAuthRefresh = useProviderAuthRefresh('trainingpeaks');

  const handleTrainingPeaksRefresh = async (): Promise<void> => {
    await tpAuthRefresh.refresh();
    await refreshTpAuth();
  };

  // Build status labels using centralized string functions
  const userName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : undefined;
  const tpLabel = buildProviderStatusLabel(
    'TrainingPeaks',
    isTpLoading,
    isTpAuthenticated,
    tpError,
    userName
  );

  const tpSubtitle = isTpAuthenticated
    ? `${AUTH_STATUS_STRINGS.TOKEN_AGE_PREFIX} ${formatTokenAge(tpTokenAge)}`
    : `${AUTH_STATUS_STRINGS.TRAINING_PEAKS.REQUIRED_PREFIX}${AUTH_STATUS_STRINGS.TRAINING_PEAKS.OPEN_TO_CAPTURE}.`;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">
          {SETTINGS_STRINGS.TITLE}
        </h2>
        <p className="text-xs text-gray-600">{SETTINGS_STRINGS.SUBTITLE}</p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-xs font-semibold text-blue-900">
          {SETTINGS_STRINGS.TRAINING_PEAKS_REQUIRED}
        </p>
        <p className="mb-2 text-xs text-blue-800">
          {SETTINGS_STRINGS.TRAINING_PEAKS_DESCRIPTION}
        </p>
        <AuthRow
          label={tpLabel}
          subtitle={tpSubtitle}
          isAuthenticated={isTpAuthenticated}
          isLoading={isTpLoading}
          error={tpError}
          onRefresh={handleTrainingPeaksRefresh}
        />
        {tpAuthRefresh.message ? (
          <p className="mt-1 text-xs text-gray-600" role="status">
            {tpAuthRefresh.message}
          </p>
        ) : null}

        <div className="mt-3 border-t border-blue-200 pt-2">
          <p className="mb-1 text-xs font-medium text-blue-900">Environment</p>
          <div className="flex gap-2">
            {(['production', 'sandbox'] as const).map((env) => (
              <label
                key={env}
                className={`flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                  tpEnvironment === env
                    ? 'border-blue-400 bg-blue-100 font-medium text-blue-900'
                    : 'border-blue-200 bg-white text-blue-800'
                } ${isTpEnvironmentLoading ? 'opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="trainingpeaks-environment"
                  value={env}
                  checked={tpEnvironment === env}
                  disabled={isTpEnvironmentLoading}
                  onChange={() => {
                    void handleTrainingPeaksEnvironmentChange(env);
                  }}
                  className="h-3 w-3"
                />
                {env === 'production' ? 'Production' : 'Sandbox'}
              </label>
            ))}
          </div>
          {tpEnvironment === 'sandbox' && (
            <p className="mt-1.5 text-[10px] text-blue-700">
              Using app.sandbox.trainingpeaks.com — sign in there to capture a
              sandbox token.
            </p>
          )}
        </div>
      </div>

      <DebugLogPanel
        key={openLogs ? 'logs-open' : 'logs-closed'}
        initialExpanded={openLogs}
      />
    </div>
  );
}

/**
 * SettingsPage component wrapped with ErrorBoundary
 *
 * Provides error handling for the settings page to prevent crashes
 * from affecting the entire extension popup.
 */
export function SettingsPage(props: SettingsPageProps): ReactElement {
  return (
    <ErrorBoundary>
      <SettingsPageContent {...props} />
    </ErrorBoundary>
  );
}
