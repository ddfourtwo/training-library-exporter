/**
 * The export file: one document holding the coach's TrainingPeaks libraries
 * and training plans, ready to be uploaded to another system.
 *
 * Two rules shape it, and both exist so a receiving system can reuse its own
 * TrainingPeaks mapping unchanged:
 *
 * 1. **TrainingPeaks payloads travel RAW.** Every `items` / `workouts` / `notes`
 *    element is exactly what tpapi returned, untouched: no field selection, no
 *    renaming, no validation beyond "is it a list". Anything a picker renders is
 *    a projection and must never become part of the file.
 * 2. **The envelope is versioned and self-describing.** `format` names the
 *    format and `version` its revision, so a reader can accept what it
 *    understands and reject the rest instead of guessing.
 *
 * The machine-readable contract is `schema/training-library-export.schema.json`
 * at the repository root; this module is the only thing that writes it.
 */

import type { ExportSource } from './sources';

/** `format` field of every file this extension writes. */
export const EXPORT_FORMAT_ID = 'training-library-export';

/** Bumped only for a breaking change to the envelope; see the schema. */
export const EXPORT_FORMAT_VERSION = 1;

/** One TrainingPeaks workout library, with its raw item rows. */
export interface LibraryExportEntry {
  /** Identity the receiver groups templates under. */
  library: { id: number; name: string };
  /** Raw rows from `/exerciselibrary/v2/libraries/{id}/items`. */
  items: unknown[];
}

/** One TrainingPeaks training plan, with its raw workout and note rows. */
export interface PlanExportEntry {
  /** The raw plan row from `/plans/v1/plansWithAccess`. */
  plan: unknown;
  /** Raw rows from `/plans/v1/plans/{id}/workouts/{start}/{end}`. */
  workouts: unknown[];
  /** Raw rows from `/plans/v1/plans/{id}/calendarNote/{start}/{end}`. */
  notes: unknown[];
  /**
   * Earliest `workoutDay` (YYYY-MM-DD) across the whole plan, or null when no
   * workout carries a usable one.
   *
   * Our own field, not TrainingPeaks data. A plan is a sequence of weeks
   * relative to its own first day, and a receiver that stores plans on absolute
   * dates needs that anchor to know how far to shift them once a coach picks
   * when week 1 starts.
   */
  plan_first_day: string | null;
}

export interface TrainingLibraryExport {
  format: typeof EXPORT_FORMAT_ID;
  version: typeof EXPORT_FORMAT_VERSION;
  /** ISO-8601 instant, UTC, when the file was built. */
  exported_at: string;
  libraries: LibraryExportEntry[];
  plans: PlanExportEntry[];
}

/** What a fetch of the raw rows for one source produced. */
export type RawSourceBundle =
  | { kind: 'library'; id: number; name: string; items: unknown[] }
  | {
      kind: 'plan';
      id: number;
      name: string;
      plan: unknown;
      workouts: unknown[];
      notes: unknown[];
    };

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * `YYYY-MM-DD` of a TrainingPeaks `workoutDay` (`2022-03-07T00:00:00`), or
 * null when the value is not a real calendar date.
 */
export function isoDay(value: unknown): string | null {
  const match = typeof value === 'string' ? ISO_DAY.exec(value) : null;
  if (!match) {
    return null;
  }
  const [day, year, month, date] = match;
  const parsed = new Date(Date.UTC(+year, +month - 1, +date));
  return parsed.toISOString().slice(0, 10) === day ? day : null;
}

/** Earliest `workoutDay` across all workouts, or null when none has one. */
export function planFirstDay(workouts: readonly unknown[]): string | null {
  let first: string | null = null;
  for (const workout of workouts) {
    const day = isoDay(
      (workout as { workoutDay?: unknown } | null)?.workoutDay
    );
    if (day !== null && (first === null || day < first)) {
      first = day;
    }
  }
  return first;
}

/**
 * Assemble the file from the bundles the background read.
 *
 * Order follows the coach's selection, so two exports of the same selection
 * differ only in `exported_at`.
 */
export function buildExportFile(
  bundles: readonly RawSourceBundle[],
  exportedAt: Date = new Date()
): TrainingLibraryExport {
  const libraries: LibraryExportEntry[] = [];
  const plans: PlanExportEntry[] = [];

  for (const bundle of bundles) {
    if (bundle.kind === 'library') {
      libraries.push({
        library: { id: bundle.id, name: bundle.name },
        items: bundle.items,
      });
    } else {
      plans.push({
        plan: bundle.plan,
        workouts: bundle.workouts,
        notes: bundle.notes,
        plan_first_day: planFirstDay(bundle.workouts),
      });
    }
  }

  return {
    format: EXPORT_FORMAT_ID,
    version: EXPORT_FORMAT_VERSION,
    exported_at: exportedAt.toISOString(),
    libraries,
    plans,
  };
}

/**
 * `training-library-export-2026-11-11.json`
 *
 * A fixed shape rather than the coach's selection: a browser that downloads two
 * files must not silently overwrite the first.
 */
export function exportFileName(exportedAt: Date = new Date()): string {
  return `${EXPORT_FORMAT_ID}-${exportedAt.toISOString().slice(0, 10)}.json`;
}

/** Totals the result panel shows after a file is written. */
export interface ExportCounts {
  libraries: number;
  plans: number;
  /** Raw workout rows across every plan, plus library item rows. */
  items: number;
}

export function countExport(file: TrainingLibraryExport): ExportCounts {
  const items =
    file.libraries.reduce((total, entry) => total + entry.items.length, 0) +
    file.plans.reduce((total, entry) => total + entry.workouts.length, 0);
  return { libraries: file.libraries.length, plans: file.plans.length, items };
}

/** Names in a file, for the confirmation dialog. */
export function describeSelection(sources: readonly ExportSource[]): {
  libraries: ExportSource[];
  plans: ExportSource[];
} {
  return {
    libraries: sources.filter((source) => source.kind === 'library'),
    plans: sources.filter((source) => source.kind === 'plan'),
  };
}
