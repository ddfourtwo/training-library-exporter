/**
 * Type definitions for the extension
 */

import type {
  AuthRefreshProvider,
  AuthRefreshResult,
} from '@/services/authRefreshService';
import type { ExportSource } from '@/export/sources';

/**
 * Message types for chrome.runtime messaging
 */
export interface TokenFoundMessage {
  type: 'TOKEN_FOUND';
  token: string;
  timestamp: number;
}

export interface GetTokenMessage {
  type: 'GET_TOKEN';
}

export interface ClearTokenMessage {
  type: 'CLEAR_TOKEN';
}

export interface ValidateTokenMessage {
  type: 'VALIDATE_TOKEN';
}

/**
 * Refresh a provider's captured token by opening a temporary background tab
 * on the site and closing it once the token lands. Never touches the coach's
 * own tabs. Handled in the background so it completes if the popup closes.
 */
export interface RefreshProviderAuthMessage {
  type: 'REFRESH_PROVIDER_AUTH';
  provider: AuthRefreshProvider;
}

export type { AuthRefreshProvider, AuthRefreshResult };

/** List the coach's TrainingPeaks plan folders, which carry their plan ids. */
export interface GetTrainingPlanFoldersMessage {
  type: 'GET_TRAINING_PLAN_FOLDERS';
}

/**
 * Message to request user profile from API
 */
export interface GetUserMessage {
  type: 'GET_USER';
}

/**
 * Message to request libraries list from API
 */
export interface GetLibrariesMessage {
  type: 'GET_LIBRARIES';
}

/**
 * Message to request library items from API
 */
export interface GetLibraryItemsMessage {
  type: 'GET_LIBRARY_ITEMS';
  libraryId: number;
}

/**
 * Message to request training plans list from API
 */
export interface GetTrainingPlansMessage {
  type: 'GET_TRAINING_PLANS';
}

/**
 * Message to request plan workouts from API
 */
export interface GetPlanWorkoutsMessage {
  type: 'GET_PLAN_WORKOUTS';
  planId: number;
}

/**
 * Message to request plan notes from API
 */
export interface GetPlanNotesMessage {
  type: 'GET_PLAN_NOTES';
  planId: number;
}

/**
 * Message to request plan events from API
 */
export interface GetPlanEventsMessage {
  type: 'GET_PLAN_EVENTS';
  planId: number;
}

/**
 * Message to get debug API logs
 */
export interface GetDebugLogsMessage {
  type: 'GET_DEBUG_LOGS';
}

/**
 * Message to clear debug API logs
 */
export interface ClearDebugLogsMessage {
  type: 'CLEAR_DEBUG_LOGS';
}

/**
 * Build and download the export file for the coach's selection. The background
 * fetches the raw TrainingPeaks payloads itself, so only identifiers travel
 * here.
 */
export interface StartLibraryExportMessage {
  type: 'START_LIBRARY_EXPORT';
  sources: ExportSource[];
}

export type RuntimeMessage =
  | TokenFoundMessage
  | GetTokenMessage
  | ClearTokenMessage
  | ValidateTokenMessage
  | RefreshProviderAuthMessage
  | GetTrainingPlanFoldersMessage
  | GetUserMessage
  | GetLibrariesMessage
  | GetLibraryItemsMessage
  | GetTrainingPlansMessage
  | GetPlanWorkoutsMessage
  | GetPlanNotesMessage
  | GetPlanEventsMessage
  | GetDebugLogsMessage
  | ClearDebugLogsMessage
  | StartLibraryExportMessage;

/**
 * Token storage structure
 */
export interface TokenStorage {
  auth_token: string | null;
  token_timestamp: number | null;
}

/**
 * Re-export LibraryItem from schema for convenience
 */
export type { LibraryItem } from '@/schemas/library.schema';
