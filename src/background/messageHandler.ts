/**
 * Message handler for background service worker
 *
 * Handles messages from content scripts and popup
 */

import type { RuntimeMessage, AuthRefreshProvider } from '@/types';
import type {
  UserProfile,
  Library,
  LibraryItem,
  TrainingPlan,
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
  ApiResponse,
} from '@/types/api.types';
import type { PlanFolder } from '@/schemas/trainingPlan.schema';
import { logger } from '@/utils/logger';
import { STORAGE_KEYS, createApiHeaders } from '@/utils/constants';
import {
  refreshProviderAuth,
  type AuthRefreshResult,
} from '@/services/authRefreshService';
import {
  getTrainingPeaksApiBaseUrl,
  getTrainingPeaksAppUrl,
} from '@/services/trainingPeaksConfigService';
import {
  fetchUser,
  fetchLibraries,
  fetchLibraryItems,
  fetchTrainingPlans,
  fetchTrainingPlanFolders,
  fetchPlanWorkouts,
  fetchPlanNotes,
  fetchPlanEvents,
} from './api/trainingPeaks';
import {
  getLogs as getDebugLogs,
  clearLogs as clearDebugLogs,
} from '@/services/debugLogService';
import type { ApiLogEntry } from '@/types/debugLog.types';
import { startLibraryExport, type ExportBuild } from './libraryExport';

type MessageResponse =
  | { success: true }
  | { success: false; error: string }
  | { token: string | null; timestamp: number | null }
  | { valid: boolean; userId?: number | string }
  | { logs: ApiLogEntry[] }
  | ApiResponse<UserProfile>
  | ApiResponse<Library[]>
  | ApiResponse<LibraryItem[]>
  | ApiResponse<TrainingPlan[]>
  | ApiResponse<PlanFolder[]>
  | ApiResponse<PlanWorkout[]>
  | ApiResponse<CalendarNote[]>
  | ApiResponse<CalendarEvent[]>
  | ApiResponse<ExportBuild>
  | AuthRefreshResult;

/**
 * Handle TOKEN_FOUND message from content script
 */
async function handleTokenFound(
  token: string,
  timestamp: number
): Promise<void> {
  try {
    logger.info('Storing TrainingPeaks authentication token');
    logger.debug('Token timestamp:', new Date(timestamp).toISOString());

    // Store token in chrome.storage.local
    await chrome.storage.local.set({
      auth_token: token,
      token_timestamp: timestamp,
    });

    logger.info('TrainingPeaks authentication token stored successfully');

    // Verify storage (debug)
    const stored = await chrome.storage.local.get([
      'auth_token',
      'token_timestamp',
    ]);
    logger.debug('Stored token verification:', {
      hasToken: !!stored.auth_token,
      hasTimestamp: !!stored.token_timestamp,
    });
  } catch (error) {
    logger.error('❌ Failed to store token:', error);
    throw error;
  }
}

/**
 * Handle GET_TOKEN message from popup
 */
async function handleGetToken(): Promise<{
  token: string | null;
  timestamp: number | null;
}> {
  try {
    const data = await chrome.storage.local.get([
      'auth_token',
      'token_timestamp',
    ]);
    return {
      token: (data.auth_token as string) || null,
      timestamp: (data.token_timestamp as number) || null,
    };
  } catch (error) {
    logger.error('Failed to retrieve token:', error);
    throw error;
  }
}

/**
 * Handle CLEAR_TOKEN message from popup
 */
async function handleClearToken(): Promise<void> {
  try {
    await chrome.storage.local.remove(['auth_token', 'token_timestamp']);
    logger.info('Token cleared');
  } catch (error) {
    logger.error('Failed to clear token:', error);
    throw error;
  }
}

/**
 * Handle VALIDATE_TOKEN message from popup
 * Validates token by calling TrainingPeaks API from background context (bypasses CORS)
 */
async function handleValidateToken(): Promise<{
  valid: boolean;
  userId?: number;
}> {
  try {
    logger.debug('Starting token validation...');

    // Get token from storage
    const data = await chrome.storage.local.get(['auth_token']);
    const token = data.auth_token as string | undefined;

    logger.debug('Has token:', !!token);

    if (!token) {
      logger.debug('No token to validate');
      return { valid: false };
    }

    // Call TrainingPeaks API from background context (has host_permissions)
    const apiBaseUrl = await getTrainingPeaksApiBaseUrl();
    const appUrl = await getTrainingPeaksAppUrl();
    const endpoint = `${apiBaseUrl}/users/v3/user`;
    logger.debug('Calling API:', endpoint);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: createApiHeaders(token, appUrl),
    });

    logger.debug('Response status:', response.status);
    logger.debug('Response ok:', response.ok);

    if (response.ok) {
      const data = await response.json();
      logger.info('Token is valid, User ID:', data.user?.userId);
      return { valid: true, userId: data.user?.userId };
    }

    // Token validation failed
    if (response.status === 401) {
      logger.warn('Token validation returned 401 (token expired)');
    } else {
      logger.error('Token validation failed - Status:', response.status);
    }

    if (response.status === 401) {
      await chrome.storage.local.remove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.TOKEN_TIMESTAMP,
      ]);
      logger.warn('Cleared TrainingPeaks auth token after VALIDATE_TOKEN 401');
    }

    logger.warn('Token validation failed');

    return { valid: false };
  } catch (error) {
    logger.error('Error validating token:', error);
    // On network error, don't clear token (might be temporary)
    return { valid: false };
  }
}

/**
 * Handle REFRESH_PROVIDER_AUTH.
 *
 * Opens a tab, so it is accepted only from the extension's own pages (no
 * `sender.tab`), never from a web page's tab.
 */
async function handleRefreshProviderAuth(
  provider: AuthRefreshProvider,
  sender: chrome.runtime.MessageSender
): Promise<AuthRefreshResult> {
  if (sender.tab) {
    logger.warn('Rejected REFRESH_PROVIDER_AUTH from a tab');
    return { outcome: 'error', error: 'Refresh not allowed from this page' };
  }

  if (provider !== 'trainingpeaks') {
    return { outcome: 'error', error: 'Unknown provider' };
  }

  return await refreshProviderAuth(provider);
}

/**
 * Handle GET_USER message from popup
 * Fetches user profile from TrainingPeaks API
 */
async function handleGetUser(): Promise<ApiResponse<UserProfile>> {
  logger.debug('Handling GET_USER message');
  return await fetchUser();
}

/**
 * Handle GET_LIBRARIES message from popup
 * Fetches libraries list from TrainingPeaks API
 */
async function handleGetLibraries(): Promise<ApiResponse<Library[]>> {
  logger.debug('Handling GET_LIBRARIES message');
  return await fetchLibraries();
}

/**
 * Handle GET_TRAINING_PLAN_FOLDERS message from popup.
 * Folders are how TrainingPeaks groups plans; each carries the ids it holds.
 */
async function handleGetTrainingPlanFolders(): Promise<
  ApiResponse<PlanFolder[]>
> {
  logger.debug('Handling GET_TRAINING_PLAN_FOLDERS message');
  return await fetchTrainingPlanFolders();
}

/**
 * Handle GET_LIBRARY_ITEMS message from popup
 * Fetches library items from TrainingPeaks API
 */
async function handleGetLibraryItems(
  libraryId: number
): Promise<ApiResponse<LibraryItem[]>> {
  logger.debug('Handling GET_LIBRARY_ITEMS message for library:', libraryId);
  return await fetchLibraryItems(libraryId);
}

/**
 * Handle GET_TRAINING_PLANS message from popup
 * Fetches training plans list from TrainingPeaks API
 */
async function handleGetTrainingPlans(): Promise<ApiResponse<TrainingPlan[]>> {
  logger.debug('Handling GET_TRAINING_PLANS message');
  return await fetchTrainingPlans();
}

/**
 * Handle GET_PLAN_WORKOUTS message from popup
 * Fetches plan workouts from TrainingPeaks API
 */
async function handleGetPlanWorkouts(
  planId: number
): Promise<ApiResponse<PlanWorkout[]>> {
  logger.debug('Handling GET_PLAN_WORKOUTS message for plan:', planId);
  return await fetchPlanWorkouts(planId);
}

/**
 * Handle GET_PLAN_NOTES message from popup
 * Fetches plan notes from TrainingPeaks API
 */
async function handleGetPlanNotes(
  planId: number
): Promise<ApiResponse<CalendarNote[]>> {
  logger.debug('Handling GET_PLAN_NOTES message for plan:', planId);
  return await fetchPlanNotes(planId);
}

/**
 * Handle GET_PLAN_EVENTS message from popup
 * Fetches plan events from TrainingPeaks API
 */
async function handleGetPlanEvents(
  planId: number
): Promise<ApiResponse<CalendarEvent[]>> {
  logger.debug('Handling GET_PLAN_EVENTS message for plan:', planId);
  return await fetchPlanEvents(planId);
}

/**
 * Handle GET_DEBUG_LOGS message from popup
 * Retrieves TrainingPeaks API call logs from chrome.storage
 */
async function handleGetDebugLogs(): Promise<{ logs: ApiLogEntry[] }> {
  const logs = await getDebugLogs();
  return { logs };
}

/**
 * Handle CLEAR_DEBUG_LOGS message from popup
 * Removes all TrainingPeaks API call logs from chrome.storage
 */
async function handleClearDebugLogs(): Promise<{ success: true }> {
  await clearDebugLogs();
  return { success: true };
}

/**
 * Handle START_LIBRARY_EXPORT from the popup.
 *
 * Accepted from extension pages only: it reads the coach's TrainingPeaks data,
 * so no web page may start it.
 */
async function handleStartLibraryExport(
  sources: unknown,
  sender: chrome.runtime.MessageSender
): Promise<ApiResponse<ExportBuild>> {
  if (sender.tab) {
    logger.warn('Rejected START_LIBRARY_EXPORT from a tab');
    return {
      success: false,
      error: {
        message: 'Export not allowed from this page',
        code: 'FORBIDDEN',
      },
    };
  }
  return await startLibraryExport(sources);
}

/**
 * Main message router
 */
export async function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  logger.debug('Background received message:', message.type, 'from:', sender);

  switch (message.type) {
    case 'TOKEN_FOUND':
      await handleTokenFound(message.token, message.timestamp);
      return { success: true };

    case 'GET_TOKEN':
      return await handleGetToken();

    case 'CLEAR_TOKEN':
      await handleClearToken();
      return { success: true };

    case 'VALIDATE_TOKEN':
      return await handleValidateToken();

    case 'REFRESH_PROVIDER_AUTH':
      return await handleRefreshProviderAuth(message.provider, sender);

    case 'GET_USER':
      return await handleGetUser();

    case 'GET_LIBRARIES':
      return await handleGetLibraries();

    case 'GET_TRAINING_PLAN_FOLDERS':
      return await handleGetTrainingPlanFolders();

    case 'GET_LIBRARY_ITEMS':
      return await handleGetLibraryItems(message.libraryId);

    case 'GET_TRAINING_PLANS':
      return await handleGetTrainingPlans();

    case 'GET_PLAN_WORKOUTS':
      return await handleGetPlanWorkouts(message.planId);

    case 'GET_PLAN_NOTES':
      return await handleGetPlanNotes(message.planId);

    case 'GET_PLAN_EVENTS':
      return await handleGetPlanEvents(message.planId);

    case 'GET_DEBUG_LOGS':
      return await handleGetDebugLogs();

    case 'CLEAR_DEBUG_LOGS':
      return await handleClearDebugLogs();

    case 'START_LIBRARY_EXPORT':
      return await handleStartLibraryExport(message.sources, sender);

    default:
      logger.warn('Unknown message type received');
      return { success: false, error: 'Unknown message type' };
  }
}
