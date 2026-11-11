/**
 * What the coach asked to export: one TrainingPeaks library or training plan.
 *
 * Pure and dependency-free so the popup, the background worker and the tests
 * all share one shape. Only identifiers travel between them; the raw
 * TrainingPeaks rows are read by the background (see `./libraryExportFile`).
 */

export type ExportSource =
  | { kind: 'library'; id: number; name: string }
  | { kind: 'plan'; id: number; name: string };

export function isExportSource(value: unknown): value is ExportSource {
  if (value === null || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  return (
    (source.kind === 'library' || source.kind === 'plan') &&
    typeof source.id === 'number' &&
    Number.isInteger(source.id) &&
    typeof source.name === 'string'
  );
}

export function sourceKey(source: ExportSource): string {
  return `${source.kind}:${source.id}`;
}
