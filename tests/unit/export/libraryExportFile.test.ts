/**
 * The export file's shape, its counts, and the one field we add.
 *
 * The fixtures are TrainingPeaks responses recorded from a real account. They
 * carry the rows a presentation schema would change — `title: null`, unknown
 * top-level keys, nested objects the picker never reads — because the whole
 * point of the file is that it keeps them.
 */

import { describe, it, expect } from 'vitest';
import libraryRow from '../../fixtures/library-row.json';
import libraryItems from '../../fixtures/library-items.json';
import planRow from '../../fixtures/plan-row.json';
import planWorkouts from '../../fixtures/plan-workouts.json';
import planNotes from '../../fixtures/plan-notes.json';
import {
  EXPORT_FORMAT_ID,
  EXPORT_FORMAT_VERSION,
  buildExportFile,
  countExport,
  exportFileName,
  isoDay,
  planFirstDay,
  describeSelection,
  type RawSourceBundle,
} from '@/export/libraryExportFile';

const EXPORTED_AT = new Date('2026-11-11T09:15:00.000Z');

const LIBRARY_BUNDLE: RawSourceBundle = {
  kind: 'library',
  id: libraryRow.exerciseLibraryId,
  name: libraryRow.libraryName,
  items: libraryItems,
};

const PLAN_BUNDLE: RawSourceBundle = {
  kind: 'plan',
  id: planRow.planId,
  name: planRow.title,
  plan: planRow,
  workouts: planWorkouts,
  notes: planNotes,
};

function build(): ReturnType<typeof buildExportFile> {
  return buildExportFile([LIBRARY_BUNDLE, PLAN_BUNDLE], EXPORTED_AT);
}

describe('buildExportFile', () => {
  it('stamps the format, version and export time', () => {
    const file = build();

    expect(file.format).toBe(EXPORT_FORMAT_ID);
    expect(file.format).toBe('training-library-export');
    expect(file.version).toBe(EXPORT_FORMAT_VERSION);
    expect(file.version).toBe(1);
    expect(file.exported_at).toBe('2026-11-11T09:15:00.000Z');
  });

  it('keeps the library identity and its raw item rows', () => {
    const [entry] = build().libraries;

    expect(entry.library).toEqual({ id: 123456, name: 'Bike: threshold' });
    // Not "the same fields": the same rows, unknown keys and nulls included.
    expect(entry.items).toEqual(libraryItems);
    expect(entry.items).toHaveLength(3);
  });

  it('keeps the plan row, workouts and notes raw', () => {
    const [entry] = build().plans;

    expect(entry.plan).toEqual(planRow);
    expect(entry.workouts).toEqual(planWorkouts);
    expect(entry.notes).toEqual(planNotes);
    // The rows a presentation schema would rewrite survive intact: both AM/PM
    // sessions on one day, with TP's own ordering, and the nulls untouched.
    expect((entry.workouts[1] as { orderOnDay: unknown }).orderOnDay).toBe(2);
    expect((entry.workouts[1] as { coachComments: unknown }).coachComments).toBeNull();
    expect(
      (entry.workouts[0] as { someNewField: unknown }).someNewField
    ).toEqual({ a: [1, { b: null }] });
  });

  it('adds the plan anchor the receiver needs to place the plan', () => {
    // Earliest workoutDay is 2024-03-06; TP's own plan startDate is 2024-03-01
    // and is deliberately not used.
    expect(build().plans[0].plan_first_day).toBe('2024-03-06');
  });

  it('puts libraries and plans in selection order', () => {
    const file = buildExportFile([PLAN_BUNDLE, LIBRARY_BUNDLE], EXPORTED_AT);

    expect(file.libraries).toHaveLength(1);
    expect(file.plans).toHaveLength(1);
  });

  it('writes an empty export rather than failing', () => {
    const file = buildExportFile([], EXPORTED_AT);

    expect(file.libraries).toEqual([]);
    expect(file.plans).toEqual([]);
    expect(countExport(file)).toEqual({ libraries: 0, plans: 0, items: 0 });
  });

  it('nulls plan_first_day for a plan with no dated workouts', () => {
    const file = buildExportFile(
      [{ ...PLAN_BUNDLE, workouts: [] }],
      EXPORTED_AT
    );

    expect(file.plans[0].plan_first_day).toBeNull();
  });
});

describe('countExport', () => {
  it('counts libraries, plans and workout rows', () => {
    expect(countExport(build())).toEqual({
      libraries: 1,
      plans: 1,
      // 3 library items + 3 plan workouts
      items: 6,
    });
  });
});

describe('exportFileName', () => {
  it('names the file after the format and the day', () => {
    expect(exportFileName(EXPORTED_AT)).toBe(
      'training-library-export-2026-11-11.json'
    );
  });
});

describe('isoDay', () => {
  it.each([
    ['2024-03-06T00:00:00', '2024-03-06'],
    ['2024-03-06', '2024-03-06'],
  ])('reads %s as %s', (input, expected) => {
    expect(isoDay(input)).toBe(expected);
  });

  it.each([null, undefined, '', 'not a date', '2024-02-31T00:00:00', 42])(
    'rejects %s',
    (input) => {
      expect(isoDay(input)).toBeNull();
    }
  );
});

describe('planFirstDay', () => {
  it('picks the earliest day, not the first row', () => {
    const workouts = [
      { workoutDay: '2024-05-01T00:00:00' },
      { workoutDay: '2024-03-06T00:00:00' },
      { workoutDay: '2024-04-01T00:00:00' },
    ];

    expect(planFirstDay(workouts)).toBe('2024-03-06');
  });

  it('ignores rows without a usable day', () => {
    const workouts = [
      { workoutDay: null },
      { title: 'no day at all' },
      { workoutDay: '2024-03-06T00:00:00' },
    ];

    expect(planFirstDay(workouts)).toBe('2024-03-06');
  });
});

describe('describeSelection', () => {
  it('splits the selection the way the dialog counts it', () => {
    expect(
      describeSelection([
        { kind: 'library', id: 1, name: 'A' },
        { kind: 'plan', id: 2, name: 'B' },
        { kind: 'library', id: 3, name: 'C' },
      ])
    ).toEqual({
      libraries: [
        { kind: 'library', id: 1, name: 'A' },
        { kind: 'library', id: 3, name: 'C' },
      ],
      plans: [{ kind: 'plan', id: 2, name: 'B' }],
    });
  });
});
