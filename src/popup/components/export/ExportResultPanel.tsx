/**
 * Export result panel
 *
 * What the file holds once it was written: how many libraries and plans, and
 * how many workout rows went with them — plus the next step, which is uploading
 * the file where the coach wants it.
 */

import type { ReactElement } from 'react';
import type { ExportOutcome } from '@/hooks/useLibraryExport';
import { ErrorReportActions } from '@/components/ErrorReportActions';
import { classifyErrorMessage } from '@/utils/errorReport';

interface ExportResultPanelProps {
  result: ExportOutcome;
  onClose: () => void;
}

function Count({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}): ReactElement {
  return (
    <div className={`rounded-md p-2 text-center ${tone}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

export function ExportResultPanel({
  result,
  onClose,
}: ExportResultPanelProps): ReactElement {
  const { counts, errors } = result;

  return (
    <div
      className="fixed inset-0 bg-black/15 backdrop-blur-sm flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-export-result-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2
            id="library-export-result-title"
            className="text-lg font-semibold text-gray-900"
          >
            {result.success ? 'Export saved' : 'Export failed'}
          </h2>
          <p className="text-sm text-gray-600">{result.fileName}</p>
        </div>

        <div className="px-6 py-4 space-y-3">
          {result.success && counts && (
            <div className="grid grid-cols-3 gap-2">
              <Count
                label="Libraries"
                value={counts.libraries}
                tone="bg-green-50 text-green-800"
              />
              <Count
                label="Plans"
                value={counts.plans}
                tone="bg-green-50 text-green-800"
              />
              <Count
                label="Workouts"
                value={counts.items}
                tone="bg-gray-50 text-gray-800"
              />
            </div>
          )}

          {result.success && (
            <p className="text-xs text-gray-600">
              The file is in your downloads. Keep it if you want a copy: it
              contains your TrainingPeaks libraries and plans as they were when
              you exported them.
            </p>
          )}

          {errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <ul className="space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
              <ErrorReportActions
                category="operation_failed"
                context={{
                  operation: 'export',
                  failureCode: classifyErrorMessage(errors[0]),
                }}
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
