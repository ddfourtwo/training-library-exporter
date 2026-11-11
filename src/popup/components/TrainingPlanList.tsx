/**
 * TrainingPlanList component
 *
 * Displays list of training plans with loading, error, and empty states
 */

import { useState, useMemo, type ReactElement } from 'react';
import { useTrainingPlans } from '@/hooks/useTrainingPlans';
import { useTrainingPlanFolders } from '@/hooks/useTrainingPlanFolders';
import { useLibraryExport } from '@/hooks/useLibraryExport';
import { groupPlansByFolder } from '@/utils/planFolderGrouping';
import type { ExportSource } from '@/export/sources';
import { TrainingPlanCard } from './TrainingPlanCard';
import { SearchBar } from './SearchBar';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { ExportDialog, ExportResultPanel } from './export';
import {
  is401Error,
  is403Error,
  getUserFriendlyErrorMessage,
} from '@/utils/trainingPeaksTab';
import { useProviderAuthRefresh } from '@/hooks/useProviderAuthRefresh';
import type { TrainingPlan } from '@/types/api.types';

export interface TrainingPlanListProps {
  onSelectPlan: (planId: number) => void;
}

/** Bucket id for plans TrainingPeaks has not filed in any folder. */

export function TrainingPlanList({
  onSelectPlan,
}: TrainingPlanListProps): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const tpAuthRefresh = useProviderAuthRefresh('trainingpeaks');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<number>>(
    new Set()
  );
  const {
    isDialogOpen,
    isExporting,
    result: importResult,
    openDialog,
    closeDialog,
    startExport,
    closeResult,
  } = useLibraryExport();
  const { data: plans, isLoading, error, refetch } = useTrainingPlans();
  const { data: planFolders } = useTrainingPlanFolders();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Filter plans based on search query
  const filteredPlans = useMemo(() => {
    if (!plans) return [];
    if (!searchQuery) return plans;

    const query = searchQuery.toLowerCase();
    return plans.filter(
      (plan) =>
        plan.title.toLowerCase().includes(query) ||
        plan.author.toLowerCase().includes(query)
    );
  }, [plans, searchQuery]);

  /**
   * Plans grouped by their TrainingPeaks folder.
   *
   * Membership lives on the folder, so a plan's group is found by looking its id
   * up across folders. Plans in no folder get an "Ungrouped" bucket rather than
   * being hidden — a plan that belongs to nothing must still be reachable.
   */
  const folderGroups = useMemo(
    () => groupPlansByFolder(filteredPlans, planFolders),
    [planFolders, filteredPlans]
  );

  const openFolder = useMemo(
    () => folderGroups.find((group) => group.id === selectedFolderId) ?? null,
    [folderGroups, selectedFolderId]
  );

  /** The plans the list is currently showing: one folder's, once one is open. */
  const visiblePlans = openFolder ? openFolder.plans : filteredPlans;

  const selectedPlans = useMemo(() => {
    if (!plans || selectedPlanIds.size === 0) {
      return [] as TrainingPlan[];
    }

    return plans.filter((plan) => selectedPlanIds.has(plan.planId));
  }, [plans, selectedPlanIds]);

  const importSources = useMemo(
    (): ExportSource[] =>
      selectedPlans.map((plan) => ({
        kind: 'plan',
        id: plan.planId,
        name: plan.title,
      })),
    [selectedPlans]
  );

  // Selection handlers
  const handleSelectionChange = (planId: number, selected: boolean): void => {
    setSelectedPlanIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(planId);
      } else {
        newSet.delete(planId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (): void => {
    const allIds = new Set(visiblePlans.map((plan) => plan.planId));
    setSelectedPlanIds(allIds);
  };

  const handleClearSelection = (): void => {
    setSelectedPlanIds(new Set());
  };

  const handleExitSelectionMode = (): void => {
    setSelectionMode(false);
    setSelectedPlanIds(new Set());
  };

  const handleEnterSelectionMode = (): void => {
    setSelectionMode(true);
  };

  const handleExportSelected = (): void => {
    if (selectedPlanIds.size === 0) {
      return;
    }

    openDialog();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    const isAuthError = is401Error(error);
    const isPermissionError = is403Error(error);
    const friendlyMessage = getUserFriendlyErrorMessage(error);

    const handleRetry = async (): Promise<void> => {
      if (isAuthError) {
        // 401: refresh the token in a background tab, then retry ourselves.
        const result = await tpAuthRefresh.refresh();
        if (result.outcome === 'refreshed') {
          refetch();
        }
      } else {
        // For other errors, just retry the request
        refetch();
      }
    };

    return (
      <div className="p-4">
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm font-medium text-red-800">
            Failed to Load Data
          </p>
          <p className="mt-1 text-xs text-red-600">{friendlyMessage}</p>
          {isAuthError && (
            <p className="mt-2 text-xs text-red-500" role="status">
              {tpAuthRefresh.message ??
                'Your TrainingPeaks sign-in expired. Refresh it in a background tab without leaving this page.'}
            </p>
          )}
          {isPermissionError && (
            <p className="mt-2 text-xs text-red-500">
              You don't have permission to access this content
            </p>
          )}
          <button
            onClick={handleRetry}
            disabled={tpAuthRefresh.isRefreshing}
            className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {tpAuthRefresh.isRefreshing
              ? 'Refreshing…'
              : isAuthError
                ? 'Refresh TrainingPeaks sign-in'
                : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  // Empty state (no plans at all)
  if (!plans || plans.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState
          title="No Plans Found"
          message="You don't have any training plans yet."
        />
      </div>
    );
  }

  // No search results state
  if (filteredPlans.length === 0) {
    return (
      <div className="mt-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search plans..."
        />
        <div className="mt-4">
          <EmptyState
            title="No Plans Found"
            message={`No plans match "${searchQuery}"`}
          />
        </div>
      </div>
    );
  }

  // Folder listing: the first thing shown, mirroring how TrainingPeaks groups
  // plans. Opening one drills into its plans.
  if (!openFolder) {
    return (
      <div className="mt-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search plans..."
        />

        <ul className="mt-4 space-y-2">
          {folderGroups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => setSelectedFolderId(group.id)}
                className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2.5 text-left hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="text-sm font-medium text-gray-800">
                  {group.name}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  {group.plans.length}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {folderGroups.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No Plans Found"
              message={
                searchQuery
                  ? `No plans match "${searchQuery}"`
                  : "You don't have any training plans yet."
              }
            />
          </div>
        ) : null}
      </div>
    );
  }

  // Success state with plans
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setSelectedFolderId(null)}
        className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
      >
        ← All plan libraries
      </button>
      <p className="mb-2 text-sm font-semibold text-gray-800">
        {openFolder.name}
      </p>
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search plans..."
      />

      {/* Selection Mode Toolbar */}
      {selectionMode ? (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
          <div className="p-3 flex items-center justify-between border-b border-blue-200">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-blue-900">
                {selectedPlanIds.size} selected
              </span>
              <div className="h-4 w-px bg-blue-300"></div>
              <button
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline-offset-2 hover:underline"
              >
                Select All ({visiblePlans.length})
              </button>
              {selectedPlanIds.size > 0 && (
                <button
                  onClick={handleClearSelection}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium underline-offset-2 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              onClick={handleExitSelectionMode}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Exit selection mode"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="p-3 bg-white">
            <button
              onClick={handleExportSelected}
              disabled={selectedPlanIds.size === 0}
              className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Import{' '}
              {selectedPlanIds.size > 0 ? `${selectedPlanIds.size} ` : ''}
              {selectedPlanIds.size === 1 ? 'Plan' : 'Plans'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleEnterSelectionMode}
            className="px-4 py-2 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Export Multiple Plans
          </button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {visiblePlans.map((plan) => (
          <TrainingPlanCard
            key={plan.planId}
            plan={plan}
            onClick={onSelectPlan}
            selectionMode={selectionMode}
            isSelected={selectedPlanIds.has(plan.planId)}
            onSelectionChange={handleSelectionChange}
          />
        ))}
      </div>

      <ExportDialog
        key={`multi-plan-import-${isDialogOpen ? 'open' : 'closed'}`}
        isOpen={isDialogOpen}
        onClose={closeDialog}
        onConfirm={() => void startExport(importSources)}
        sources={importSources}
        isExporting={isExporting}
      />

      {importResult && (
        <ExportResultPanel result={importResult} onClose={closeResult} />
      )}
    </div>
  );
}
