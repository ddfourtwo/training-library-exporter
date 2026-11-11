/**
 * The background side of an export: read every selected source from
 * TrainingPeaks, then assemble the file.
 *
 * The API client is mocked here; that it forwards raw rows is pinned separately
 * in `tests/unit/background/api/trainingPeaks.nativePlanSources.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchNativeLibraryItems,
  fetchNativeTrainingPlanSources,
} from '@/background/api/trainingPeaks';
import { startLibraryExport } from '@/background/libraryExport';
import libraryItems from '../../fixtures/library-items.json';
import planRow from '../../fixtures/plan-row.json';
import planWorkouts from '../../fixtures/plan-workouts.json';
import planNotes from '../../fixtures/plan-notes.json';

vi.mock('@/background/api/trainingPeaks', () => ({
  fetchNativeLibraryItems: vi.fn(),
  fetchNativeTrainingPlanSources: vi.fn(),
}));

const LIBRARY: { kind: 'library'; id: number; name: string } = {
  kind: 'library',
  id: 123456,
  name: 'Bike: threshold',
};

const PLAN: { kind: 'plan'; id: number; name: string } = {
  kind: 'plan',
  id: 424242,
  name: 'Base 12 weeks',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchNativeLibraryItems).mockResolvedValue({
    success: true,
    data: libraryItems,
  });
  vi.mocked(fetchNativeTrainingPlanSources).mockResolvedValue({
    success: true,
    data: {
      plan: planRow,
      planWorkouts,
      calendarNotes: planNotes,
    },
  });
});

describe('startLibraryExport', () => {
  it('assembles one file from every selected source', async () => {
    const result = await startLibraryExport([LIBRARY, PLAN]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const { file, fileName, counts } = result.data;
    expect(fetchNativeLibraryItems).toHaveBeenCalledWith(123456);
    expect(fetchNativeTrainingPlanSources).toHaveBeenCalledWith(424242);
    expect(file.libraries).toHaveLength(1);
    expect(file.plans).toHaveLength(1);
    expect(file.libraries[0].items).toEqual(libraryItems);
    expect(file.plans[0].plan_first_day).toBe('2024-03-06');
    expect(fileName).toMatch(/^training-library-export-\d{4}-\d{2}-\d{2}\.json$/);
    expect(counts).toEqual({ libraries: 1, plans: 1, items: 6 });
  });

  it('reads only the sources it was given', async () => {
    await startLibraryExport([LIBRARY]);

    expect(fetchNativeLibraryItems).toHaveBeenCalledTimes(1);
    expect(fetchNativeTrainingPlanSources).not.toHaveBeenCalled();
  });

  it.each([
    ['nothing at all', []],
    ['a value that is not a list', 'libraries'],
    ['a source with no id', [{ kind: 'library', name: 'A' }]],
    ['a source with an unknown kind', [{ kind: 'workout', id: 1, name: 'A' }]],
  ])('refuses %s', async (_label, sources) => {
    const result = await startLibraryExport(sources);

    expect(result.success).toBe(false);
    expect(fetchNativeLibraryItems).not.toHaveBeenCalled();
  });

  it('writes no file when one source cannot be read', async () => {
    vi.mocked(fetchNativeTrainingPlanSources).mockResolvedValue({
      success: false,
      error: { message: 'Not shared with you', code: 'FORBIDDEN' },
    });

    const result = await startLibraryExport([LIBRARY, PLAN]);

    expect(result.success).toBe(false);
    if (result.success) return;
    // The failing source is named, so the coach knows which one to retry.
    expect(result.error.message).toContain('Base 12 weeks');
    expect(result.error.message).toContain('Not shared with you');
    expect(result.error.code).toBe('FORBIDDEN');
  });

  it('stops at the first failing source', async () => {
    vi.mocked(fetchNativeLibraryItems).mockResolvedValue({
      success: false,
      error: { message: 'Gone', code: 'NOT_FOUND' },
    });

    await startLibraryExport([LIBRARY, PLAN]);

    expect(fetchNativeTrainingPlanSources).not.toHaveBeenCalled();
  });

  it('runs one export at a time', async () => {
    const first = startLibraryExport([LIBRARY]);
    const second = await startLibraryExport([PLAN]);

    await first;

    expect(second.success).toBe(false);
    if (second.success) return;
    expect(second.error.code).toBe('EXPORT_IN_PROGRESS');
  });
});
