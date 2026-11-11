/**
 * Reads the coach's selection from TrainingPeaks and assembles the export file.
 *
 * Runs in the service worker, not the popup: only the background holds the
 * captured TrainingPeaks session and the host permissions. The popup asks for
 * the file and writes it to disk.
 *
 * Fetching is all-or-nothing. A file that is missing one of the libraries the
 * coach ticked looks complete and is not, so a single failed read aborts the
 * export and says which source it was.
 */

import type { ApiResponse } from '@/types/api.types';
import {
  fetchNativeLibraryItems,
  fetchNativeTrainingPlanSources,
} from './api/trainingPeaks';
import type { ExportSource } from '@/export/sources';
import { isExportSource } from '@/export/sources';
import {
  buildExportFile,
  countExport,
  exportFileName,
  type ExportCounts,
  type RawSourceBundle,
  type TrainingLibraryExport,
} from '@/export/libraryExportFile';
import { logger } from '@/utils/logger';

export interface ExportBuild {
  file: TrainingLibraryExport;
  fileName: string;
  counts: ExportCounts;
}

/** One export at a time: they share the TrainingPeaks session and the disk. */
let activeBuild: Promise<ApiResponse<ExportBuild>> | null = null;

function failure(message: string, code: string): ApiResponse<ExportBuild> {
  return { success: false, error: { message, code } };
}

async function readSource(
  source: ExportSource
): Promise<ApiResponse<RawSourceBundle>> {
  if (source.kind === 'library') {
    const result = await fetchNativeLibraryItems(source.id);
    if (!result.success) {
      return result;
    }
    return {
      success: true,
      data: {
        kind: 'library',
        id: source.id,
        name: source.name,
        items: result.data,
      },
    };
  }

  const result = await fetchNativeTrainingPlanSources(source.id);
  if (!result.success) {
    return result;
  }
  return {
    success: true,
    data: {
      kind: 'plan',
      id: source.id,
      name: source.name,
      plan: result.data.plan,
      workouts: result.data.planWorkouts,
      notes: result.data.calendarNotes,
    },
  };
}

async function build(sources: ExportSource[]): Promise<ApiResponse<ExportBuild>> {
  const bundles: RawSourceBundle[] = [];
  for (const source of sources) {
    const result = await readSource(source);
    if (!result.success) {
      return failure(
        `Could not read "${source.name}" from TrainingPeaks: ${result.error.message}`,
        result.error.code ?? 'TRAININGPEAKS_READ_FAILED'
      );
    }
    bundles.push(result.data);
  }

  try {
    const file = buildExportFile(bundles);
    return {
      success: true,
      data: { file, fileName: exportFileName(), counts: countExport(file) },
    };
  } catch (error) {
    logger.error('Building the export file failed:', error);
    return failure(
      error instanceof Error ? error.message : 'Could not build the export file',
      'EXPORT_ERROR'
    );
  }
}

export function startLibraryExport(
  sources: unknown
): Promise<ApiResponse<ExportBuild>> {
  if (
    !Array.isArray(sources) ||
    sources.length === 0 ||
    !sources.every(isExportSource)
  ) {
    return Promise.resolve(
      failure('Select at least one library or plan to export', 'INVALID_REQUEST')
    );
  }
  if (activeBuild) {
    return Promise.resolve(
      failure('An export is already running', 'EXPORT_IN_PROGRESS')
    );
  }

  const run = build(sources);
  activeBuild = run;
  return run.finally(() => {
    activeBuild = null;
  });
}
