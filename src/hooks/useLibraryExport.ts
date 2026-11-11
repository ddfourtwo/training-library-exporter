/**
 * useLibraryExport
 *
 * Asks the background for the export file for the coach's selection and writes
 * it to disk. Holds the confirm-dialog and result state the popup surfaces need.
 *
 * The file is built in the background (only it holds the TrainingPeaks session)
 * and downloaded here (only a document can start a download).
 */

import { useCallback, useState } from 'react';
import type { ApiResponse } from '@/types/api.types';
import type { StartLibraryExportMessage } from '@/types';
import type { ExportSource } from '@/export/sources';
import type { ExportBuild } from '@/background/libraryExport';
import type { ExportCounts } from '@/export/libraryExportFile';
import { downloadJsonFile } from '@/utils/downloadJson';
import { logger } from '@/utils/logger';

/** What the result panel shows once an export finishes. */
export interface ExportOutcome {
  success: boolean;
  fileName: string;
  counts?: ExportCounts;
  errors: string[];
}

export interface UseLibraryExportReturn {
  isDialogOpen: boolean;
  isExporting: boolean;
  result: ExportOutcome | null;
  openDialog: () => void;
  closeDialog: () => void;
  startExport: (sources: ExportSource[]) => Promise<void>;
  closeResult: () => void;
}

function failure(fileName: string, message: string): ExportOutcome {
  return { success: false, fileName, counts: undefined, errors: [message] };
}

export function useLibraryExport(): UseLibraryExportReturn {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<ExportOutcome | null>(null);

  const openDialog = useCallback(() => setIsDialogOpen(true), []);
  const closeDialog = useCallback(() => setIsDialogOpen(false), []);
  const closeResult = useCallback(() => setResult(null), []);

  const startExport = useCallback(
    async (sources: ExportSource[]): Promise<void> => {
      if (sources.length === 0) return;
      setIsExporting(true);
      try {
        const response = await chrome.runtime.sendMessage<
          StartLibraryExportMessage,
          ApiResponse<ExportBuild>
        >({ type: 'START_LIBRARY_EXPORT', sources });

        if (!response?.success) {
          setResult(
            failure(
              'Export',
              response?.error.message ?? 'No response from the extension'
            )
          );
          return;
        }

        const { file, fileName, counts } = response.data;
        try {
          downloadJsonFile(file, fileName);
        } catch (error) {
          logger.error('[useLibraryExport] Download failed:', error);
          setResult(
            failure(
              fileName,
              error instanceof Error
                ? `Could not save the file: ${error.message}`
                : 'Could not save the file'
            )
          );
          return;
        }
        setResult({ success: true, fileName, counts, errors: [] });
      } catch (error) {
        logger.error('[useLibraryExport] Export failed:', error);
        setResult(
          failure(
            'Export',
            error instanceof Error ? error.message : 'Export failed'
          )
        );
      } finally {
        setIsExporting(false);
        setIsDialogOpen(false);
      }
    },
    []
  );

  return {
    isDialogOpen,
    isExporting,
    result,
    openDialog,
    closeDialog,
    startExport,
    closeResult,
  };
}
