/**
 * TrainingPeaks API client for background service worker
 *
 * Handles authenticated requests to TrainingPeaks API with Zod validation
 */

import {
  STORAGE_KEYS,
  PLAN_DATE_RANGE,
  createApiHeaders,
} from '@/utils/constants';
import {
  getTrainingPeaksApiBaseUrl,
  getTrainingPeaksAppUrl,
} from '@/services/trainingPeaksConfigService';
import { logger } from '@/utils/logger';
import { addLog } from '@/services/debugLogService';
import {
  UserApiResponseSchema,
  LibrariesApiResponseSchema,
  LibraryItemsApiResponseSchema,
  TrainingPlansApiResponseSchema,
  PlanFoldersApiResponseSchema,
  PlanWorkoutsApiResponseSchema,
  CalendarNotesApiResponseSchema,
  CalendarEventsApiResponseSchema,
} from '@/schemas';
import type {
  ApiResponse,
  UserProfile,
  Library,
  LibraryItem,
  TrainingPlan,
  PlanWorkout,
  CalendarNote,
  CalendarEvent,
} from '@/types/api.types';
import type { PlanFolder } from '@/schemas/trainingPlan.schema';
import type { ApiError as ApiErrorType } from '@/schemas/api.schema';
import type { z } from 'zod';

const MAX_VALIDATION_INPUT_LENGTH = 300;

interface ValidationErrorDetails {
  path: string;
  message: string;
  inputPreview: string;
}

/**
 * Get authentication token from storage
 */
async function getAuthToken(): Promise<string | null> {
  const { auth_token } = await chrome.storage.local.get([
    STORAGE_KEYS.AUTH_TOKEN,
  ]);
  return (auth_token as string | undefined) || null;
}

/**
 * Clear stored TrainingPeaks auth token and timestamp.
 *
 * The popup auth panel listens to storage changes and will immediately reflect
 * the unauthenticated state when these keys are removed.
 */
async function clearAuthToken(): Promise<void> {
  try {
    await chrome.storage.local.remove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.TOKEN_TIMESTAMP,
    ]);
    logger.warn('Cleared TrainingPeaks auth token after 401 response');
  } catch (error) {
    logger.error('Failed to clear TrainingPeaks auth token after 401:', error);
  }
}

/**
 * Make authenticated API request
 *
 * @param endpoint - API endpoint path
 * @param baseUrl - Optional base URL. Defaults to the active TrainingPeaks
 *   environment API (production/sandbox).
 */
async function makeApiRequest(
  endpoint: string,
  baseUrl?: string
): Promise<Response> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('NO_TOKEN');
  }

  const resolvedBaseUrl = baseUrl ?? (await getTrainingPeaksApiBaseUrl());
  // Every request is made with the active environment's app origin, so sandbox
  // requests never carry a production one.
  const appOrigin = await getTrainingPeaksAppUrl();

  const response = await fetch(`${resolvedBaseUrl}${endpoint}`, {
    headers: createApiHeaders(token, appOrigin),
  });

  // Handle 401 Unauthorized - clear invalid token
  if (response.status === 401) {
    logger.warn(`401 Unauthorized on ${endpoint} - Token may be expired`);
    console.warn(
      `[TP Extension - Background] ⚠️ 401 on ${endpoint} - clearing token to update auth UI`
    );
    await clearAuthToken();
  }

  return response;
}

function formatValidationPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return 'response';
  }

  return path
    .map((segment, index) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }

      const key = String(segment);
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
        return index === 0 ? key : `.${key}`;
      }

      return `[${JSON.stringify(key)}]`;
    })
    .join('');
}

function getValueAtPath(input: unknown, path: PropertyKey[]): unknown {
  let cursor: unknown = input;

  for (const segment of path) {
    if (cursor === null || cursor === undefined) {
      return undefined;
    }

    if (typeof segment === 'number') {
      if (!Array.isArray(cursor)) {
        return undefined;
      }

      cursor = cursor[segment];
      continue;
    }

    if (typeof cursor !== 'object') {
      return undefined;
    }

    cursor = (cursor as Record<PropertyKey, unknown>)[segment];
  }

  return cursor;
}

function stringifyValidationInput(input: unknown): string {
  if (input === undefined) {
    return 'undefined';
  }

  if (typeof input === 'string') {
    return input;
  }

  try {
    const serialized = JSON.stringify(input);
    if (serialized !== undefined) {
      return serialized;
    }
  } catch {
    // Ignore serialization errors and fall back to String().
  }

  return String(input);
}

function truncateForLog(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function extractValidationErrorDetails(
  error: z.ZodError,
  responseJson: unknown
): ValidationErrorDetails {
  const firstIssue = error.issues[0];

  if (!firstIssue) {
    return {
      path: 'response',
      message: 'Unknown validation error',
      inputPreview: 'undefined',
    };
  }

  const issueInput =
    firstIssue.input ?? getValueAtPath(responseJson, firstIssue.path);

  return {
    path: formatValidationPath(firstIssue.path),
    message: firstIssue.message,
    inputPreview: truncateForLog(
      stringifyValidationInput(issueInput),
      MAX_VALIDATION_INPUT_LENGTH
    ),
  };
}

/**
 * The outcome of one authenticated GET, before any schema is applied.
 *
 * Success carries the value of `response.json()` exactly as parsed. Every
 * failure branch — no token, HTTP error, network error — is logged here once,
 * so the validating and native paths cannot drift in what they record.
 */
type JsonFetchOutcome =
  | { success: true; json: unknown; status: number; durationMs: number }
  | { success: false; error: ApiErrorType };

async function fetchJsonResponse(
  endpoint: string,
  operationName: string,
  baseUrl?: string
): Promise<JsonFetchOutcome> {
  const startTime = performance.now();
  const effectiveBaseUrl = baseUrl ?? (await getTrainingPeaksApiBaseUrl());

  try {
    logger.debug(`Fetching ${operationName}`);

    const response = await makeApiRequest(endpoint, baseUrl);
    const durationMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      // Log HTTP error
      void addLog({
        timestamp: Date.now(),
        endpoint,
        method: 'GET',
        baseUrl: effectiveBaseUrl,
        status: response.status,
        success: false,
        durationMs,
        errorMessage: `HTTP ${response.status}`,
        operationName,
      });

      return {
        success: false,
        error: {
          message: `HTTP ${response.status}`,
          status: response.status,
        },
      };
    }

    const json: unknown = await response.json();

    return { success: true, json, status: response.status, durationMs };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);

    if (error instanceof Error && error.message === 'NO_TOKEN') {
      // Log NO_TOKEN error
      void addLog({
        timestamp: Date.now(),
        endpoint,
        method: 'GET',
        baseUrl: effectiveBaseUrl,
        status: null,
        success: false,
        durationMs,
        errorMessage: 'Not authenticated',
        errorCode: 'NO_TOKEN',
        operationName,
      });

      return {
        success: false,
        error: {
          message: 'Not authenticated',
          code: 'NO_TOKEN',
        },
      };
    }

    logger.error(`Error fetching ${operationName}:`, error);

    // Log unknown error
    void addLog({
      timestamp: Date.now(),
      endpoint,
      method: 'GET',
      baseUrl: effectiveBaseUrl,
      status: null,
      success: false,
      durationMs,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      operationName,
    });

    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Generic API request handler with Zod validation
 *
 * @param endpoint - API endpoint path
 * @param schema - Zod schema for response validation
 * @param operationName - Human-readable operation name for logging
 * @param baseUrl - Optional base URL override (defaults to TP API base URL)
 * @param options - Optional behavior flags. Set `includeRaw` to carry the
 *   unvalidated JSON alongside the validated data.
 * @returns Validated response data or error
 */
async function apiRequest<T>(
  endpoint: string,
  schema: z.ZodSchema<T>,
  operationName: string,
  baseUrl?: string,
  options?: { includeRaw?: boolean }
): Promise<ApiResponse<T>> {
  const fetched = await fetchJsonResponse(endpoint, operationName, baseUrl);
  if (!fetched.success) {
    return fetched;
  }

  const effectiveBaseUrl = baseUrl ?? (await getTrainingPeaksApiBaseUrl());
  const { json, status, durationMs } = fetched;

  const validationResult = schema.safeParse(json);

  if (!validationResult.success) {
    const details = extractValidationErrorDetails(validationResult.error, json);
    const errorMessage = `Response validation failed at ${details.path}: ${details.message}`;

    logger.error(`${operationName} validation failed:`, {
      path: details.path,
      message: details.message,
      input: details.inputPreview,
      issues: validationResult.error.issues,
    });

    void addLog({
      timestamp: Date.now(),
      endpoint,
      method: 'GET',
      baseUrl: effectiveBaseUrl,
      status,
      success: false,
      durationMs,
      errorMessage,
      errorCode: 'VALIDATION_ERROR',
      validationPath: details.path,
      validationIssue: details.message,
      validationInput: details.inputPreview,
      operationName,
    });

    return {
      success: false,
      error: {
        message: `${errorMessage}. Input: ${details.inputPreview}`,
        code: 'VALIDATION_ERROR',
      },
    };
  }

  const validated = validationResult.data;

  // Log success
  void addLog({
    timestamp: Date.now(),
    endpoint,
    method: 'GET',
    baseUrl: effectiveBaseUrl,
    status,
    success: true,
    durationMs,
    operationName,
  });

  logger.info(`${operationName} fetched successfully`);
  return options?.includeRaw
    ? { success: true, data: validated, raw: json }
    : { success: true, data: validated };
}

/**
 * Fetch an endpoint and return `response.json()` **untouched**.
 *
 * This is the native path the export forwards. Nothing here
 * selects fields, strips unknown keys, defaults a null or drops a row: the
 * schemas above build a separate read-only projection for the picker, and
 * their output must never become an import payload (a stripped key or a
 * `null` turned into `0` would be recorded server-side as TrainingPeaks'
 * word). The only check is the one the server itself makes at its boundary,
 * that a list endpoint returned a list, so declared counts can be taken from
 * it; everything inside is opaque.
 */
async function fetchNativeJson(
  endpoint: string,
  operationName: string,
  baseUrl?: string
): Promise<ApiResponse<unknown>> {
  const fetched = await fetchJsonResponse(endpoint, operationName, baseUrl);
  if (!fetched.success) {
    return fetched;
  }

  void addLog({
    timestamp: Date.now(),
    endpoint,
    method: 'GET',
    baseUrl: baseUrl ?? (await getTrainingPeaksApiBaseUrl()),
    status: fetched.status,
    success: true,
    durationMs: fetched.durationMs,
    operationName,
  });

  return { success: true, data: fetched.json };
}

async function fetchNativeList(
  endpoint: string,
  operationName: string,
  baseUrl?: string
): Promise<ApiResponse<unknown[]>> {
  const result = await fetchNativeJson(endpoint, operationName, baseUrl);
  if (!result.success) {
    return result;
  }

  if (!Array.isArray(result.data)) {
    return {
      success: false,
      error: {
        message: `Expected ${operationName} to be a list, got ${describeJsonKind(result.data)}`,
        code: 'VALIDATION_ERROR',
      },
    };
  }

  return { success: true, data: result.data };
}

function describeJsonKind(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'a list';
  }
  return typeof value === 'object' ? 'an object' : typeof value;
}

/**
 * Fetch user profile from TrainingPeaks API
 *
 * @returns User profile data or error
 */
export async function fetchUser(): Promise<ApiResponse<UserProfile>> {
  const result = await apiRequest(
    '/users/v3/user',
    UserApiResponseSchema,
    'user profile'
  );

  // Extract user from wrapper response
  if (result.success) {
    return { success: true, data: result.data.user };
  }

  return result;
}

/**
 * Fetch libraries list from TrainingPeaks API
 *
 * @returns Array of libraries or error
 */
export async function fetchLibraries(): Promise<ApiResponse<Library[]>> {
  return apiRequest(
    '/exerciselibrary/v2/libraries',
    LibrariesApiResponseSchema,
    'libraries'
  );
}

/**
 * Fetch library items (workouts) from TrainingPeaks API
 *
 * @param libraryId - ID of the library to fetch items from
 * @returns Array of library items or error
 */
export async function fetchLibraryItems(
  libraryId: number
): Promise<ApiResponse<LibraryItem[]>> {
  return apiRequest(
    `/exerciselibrary/v2/libraries/${libraryId}/items`,
    LibraryItemsApiResponseSchema,
    `library ${libraryId} items`
  );
}

/**
 * Fetch training plans from TrainingPeaks API
 *
 * @returns Array of training plans or error
 */
export async function fetchTrainingPlans(): Promise<
  ApiResponse<TrainingPlan[]>
> {
  const endpoint = '/plans/v1/plansWithAccess';
  const operationName = 'training plans';

  const result = await apiRequest(
    endpoint,
    TrainingPlansApiResponseSchema,
    operationName
  );

  if (!result.success) {
    return result;
  }

  const { items, skipped } = result.data;

  // A dropped plan is invisible to the coach - the list just comes back one
  // short - so it has to reach the exported debug log, which is how these
  // reports actually arrive. Logged as a success: the request worked and the
  // other plans are usable.
  if (skipped.length > 0) {
    const first = skipped[0];
    const inputPreview = truncateForLog(
      stringifyValidationInput(first.input),
      MAX_VALIDATION_INPUT_LENGTH
    );

    logger.warn(
      `${operationName}: skipped ${skipped.length} unreadable row(s)`,
      {
        skipped,
      }
    );

    void addLog({
      timestamp: Date.now(),
      endpoint,
      method: 'GET',
      baseUrl: await getTrainingPeaksApiBaseUrl(),
      status: 200,
      success: true,
      durationMs: 0,
      errorMessage: `Skipped ${skipped.length} of ${items.length + skipped.length} training plans that failed validation at ${first.path}: ${first.message}`,
      errorCode: 'PARTIAL_VALIDATION',
      validationPath: first.path,
      validationIssue: first.message,
      validationInput: inputPreview,
      operationName,
    });
  }

  return { success: true, data: items };
}

/**
 * Fetch the coach's plan folders.
 *
 * Folders are the grouping TrainingPeaks shows above the plan list. Each folder
 * carries the ids of the plans inside it, so a plan's folder is resolved by
 * searching for the folder containing it.
 */
export async function fetchTrainingPlanFolders(): Promise<
  ApiResponse<PlanFolder[]>
> {
  return apiRequest(
    '/planfolder/v1/folder/all',
    PlanFoldersApiResponseSchema,
    'training plan folders'
  );
}

/**
 * Fetch workouts for a specific training plan from TrainingPeaks API
 *
 * @param planId - ID of the training plan to fetch workouts from
 * @returns Array of plan workouts or error
 */
export async function fetchPlanWorkouts(
  planId: number
): Promise<ApiResponse<PlanWorkout[]>> {
  return apiRequest(
    `/plans/v1/plans/${planId}/workouts/${PLAN_DATE_RANGE.START_DATE}/${PLAN_DATE_RANGE.END_DATE}`,
    PlanWorkoutsApiResponseSchema,
    `plan ${planId} workouts`
  );
}

/**
 * Fetch calendar notes for a specific training plan from TrainingPeaks API
 *
 * @param planId - ID of the training plan to fetch notes from
 * @returns Array of calendar notes or error
 */
export async function fetchPlanNotes(
  planId: number
): Promise<ApiResponse<CalendarNote[]>> {
  return apiRequest(
    `/plans/v1/plans/${planId}/calendarNote/${PLAN_DATE_RANGE.START_DATE}/${PLAN_DATE_RANGE.END_DATE}`,
    CalendarNotesApiResponseSchema,
    `plan ${planId} notes`
  );
}

/**
 * Fetch events for a specific training plan from TrainingPeaks API
 *
 * @param planId - ID of the training plan to fetch events from
 * @returns Array of calendar events or error
 */
export async function fetchPlanEvents(
  planId: number
): Promise<ApiResponse<CalendarEvent[]>> {
  return apiRequest(
    `/plans/v1/plans/${planId}/events/${PLAN_DATE_RANGE.START_DATE}/${PLAN_DATE_RANGE.END_DATE}`,
    CalendarEventsApiResponseSchema,
    `plan ${planId} events`
  );
}

/**
 * The native TrainingPeaks payloads a plan export carries.
 *
 * Each field is the value `response.json()` produced for that endpoint, or
 * for `plan` the element of the plan list whose `planId` matches — the same
 * object, not a copy with fields selected. Plan strength-builder detail is
 * deliberately not fetched: it is out of scope for the export.
 *
 * Presentation types (`TrainingPlan`, `PlanWorkout`, …) are deliberately not
 * used here: they are what the picker renders, and a picker row that fails or
 * is dropped must still reach the file untouched.
 */
export interface NativeTrainingPlanSources {
  plan: unknown;
  planWorkouts: unknown[];
  calendarNotes: unknown[];
}

/** Read `planId` off a native plan row without asserting anything else. */
function nativePlanIdOf(row: unknown): number | null {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) {
    return null;
  }
  const value = (row as { planId?: unknown }).planId;
  return typeof value === 'number' ? value : null;
}

/**
 * Fetch a library's items exactly as TrainingPeaks returned them.
 *
 * `LibraryItem` is the picker's Zod projection and must never become an
 * import payload; this forwards the raw rows after a "is it a list" check.
 */
export async function fetchNativeLibraryItems(
  libraryId: number
): Promise<ApiResponse<unknown[]>> {
  return fetchNativeList(
    `/exerciselibrary/v2/libraries/${libraryId}/items`,
    `library ${libraryId} items (native)`
  );
}

/**
 * Fetch the native payloads of one training plan for the export.
 *
 * Three GETs, all retained as-is (see `NativeTrainingPlanSources`). A failure
 * on any of them fails the whole bundle: a plan imported without its notes
 * would look complete.
 */
export async function fetchNativeTrainingPlanSources(
  planId: number
): Promise<ApiResponse<NativeTrainingPlanSources>> {
  const plansResult = await fetchNativeList(
    '/plans/v1/plansWithAccess',
    'training plans (native)'
  );
  if (!plansResult.success) {
    return plansResult;
  }

  const plan = plansResult.data.find((row) => nativePlanIdOf(row) === planId);
  if (plan === undefined) {
    return {
      success: false,
      error: {
        message: `Training plan ${planId} is not in the coach's TrainingPeaks plan list`,
        code: 'NOT_FOUND',
      },
    };
  }

  const range = `${PLAN_DATE_RANGE.START_DATE}/${PLAN_DATE_RANGE.END_DATE}`;
  const [planWorkouts, calendarNotes] = await Promise.all([
    fetchNativeList(
      `/plans/v1/plans/${planId}/workouts/${range}`,
      `plan ${planId} workouts (native)`
    ),
    fetchNativeList(
      `/plans/v1/plans/${planId}/calendarNote/${range}`,
      `plan ${planId} notes (native)`
    ),
  ]);

  if (!planWorkouts.success) {
    return planWorkouts;
  }
  if (!calendarNotes.success) {
    return calendarNotes;
  }

  return {
    success: true,
    data: {
      plan,
      planWorkouts: planWorkouts.data,
      calendarNotes: calendarNotes.data,
    },
  };
}
