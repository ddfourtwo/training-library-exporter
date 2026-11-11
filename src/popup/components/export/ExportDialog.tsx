/**
 * Export dialog
 *
 * The single confirmation step before libraries and plans are read from
 * TrainingPeaks and written to a file: what will be read, the ownership
 * acknowledgement, and the note that nothing leaves the browser.
 */

import type { ReactElement } from 'react';
import { useState } from 'react';
import type { ExportSource } from '@/export/sources';
import { describeSelection } from '@/export/libraryExportFile';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sources: ExportSource[];
  isExporting: boolean;
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function ExportDialog({
  isOpen,
  onClose,
  onConfirm,
  sources,
  isExporting,
}: ExportDialogProps): ReactElement | null {
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  if (!isOpen) {
    return null;
  }

  const { libraries, plans } = describeSelection(sources);
  const summary = [
    libraries.length > 0 ? countLabel(libraries.length, 'library') : null,
    plans.length > 0 ? countLabel(plans.length, 'training plan') : null,
  ]
    .filter(Boolean)
    .join(' and ');

  return (
    <div
      className="fixed inset-0 bg-black/15 backdrop-blur-sm flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-export-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2
            id="library-export-title"
            className="text-lg font-semibold text-gray-900"
          >
            Download export file
          </h2>
          <p className="text-sm text-gray-600">{summary}</p>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700">
            <p className="font-medium text-gray-900">What will be exported?</p>
            <ul className="mt-1 list-disc pl-5 text-xs space-y-0.5">
              {sources.slice(0, 5).map((source) => (
                <li key={`${source.kind}:${source.id}`}>{source.name}</li>
              ))}
              {sources.length > 5 && <li>and {sources.length - 5} more</li>}
            </ul>
            <p className="mt-2 text-xs text-gray-600">
              One JSON file is saved to your downloads. Nothing is uploaded: the
              data is read from TrainingPeaks in this browser and written
              straight to the file.
            </p>
          </div>

          {isExporting ? (
            <p className="text-xs text-blue-900" role="status">
              Reading from TrainingPeaks…
            </p>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-sm font-medium text-amber-900 mb-2">
                Authorization Required
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAcknowledged}
                  onChange={(event) => setHasAcknowledged(event.target.checked)}
                  className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-amber-900">
                  I confirm that I am the owner of this content or have been
                  authorized by the owner to export it
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isExporting || !hasAcknowledged}
            className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
