/**
 * The published JSON Schema, checked against what the extension actually
 * writes.
 *
 * The schema is the contract another system reads, so it is tested rather than
 * written once and trusted: a field added to `buildExportFile` without a schema
 * entry must fail here, not in someone else's importer.
 */

import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../../../schema/training-library-export.schema.json';
import libraryRow from '../../fixtures/library-row.json';
import libraryItems from '../../fixtures/library-items.json';
import planRow from '../../fixtures/plan-row.json';
import planWorkouts from '../../fixtures/plan-workouts.json';
import planNotes from '../../fixtures/plan-notes.json';
import {
  buildExportFile,
  type TrainingLibraryExport,
} from '@/export/libraryExportFile';

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const EXPORTED_AT = new Date('2026-11-11T09:15:00.000Z');

function sampleFile(): TrainingLibraryExport {
  return buildExportFile(
    [
      {
        kind: 'library',
        id: libraryRow.exerciseLibraryId,
        name: libraryRow.libraryName,
        items: libraryItems,
      },
      {
        kind: 'plan',
        id: planRow.planId,
        name: planRow.title,
        plan: planRow,
        workouts: planWorkouts,
        notes: planNotes,
      },
    ],
    EXPORTED_AT
  );
}

describe('training-library-export.schema.json', () => {
  it('is valid JSON Schema 2020-12', () => {
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(ajv.validateSchema(schema)).toBe(true);
  });

  it('accepts the file the extension writes', () => {
    const file = sampleFile();

    expect(validate(file)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it('accepts an export with no libraries or plans', () => {
    expect(validate(buildExportFile([], EXPORTED_AT))).toBe(true);
  });

  it('accepts a plan whose workouts carry no date', () => {
    const file = buildExportFile(
      [
        {
          kind: 'plan',
          id: planRow.planId,
          name: planRow.title,
          plan: planRow,
          workouts: [],
          notes: [],
        },
      ],
      EXPORTED_AT
    );

    expect(file.plans[0].plan_first_day).toBeNull();
    expect(validate(file)).toBe(true);
  });

  it.each([
    ['a foreign format', (file: TrainingLibraryExport) => ({ ...file, format: 'other' })],
    ['a future version', (file: TrainingLibraryExport) => ({ ...file, version: 2 })],
    [
      'a missing export time',
      (file: TrainingLibraryExport) => {
        const { exported_at: _omitted, ...rest } = file;
        return rest;
      },
    ],
    [
      'an unknown top-level field',
      (file: TrainingLibraryExport) => ({ ...file, generator: 'x' }),
    ],
    [
      'a library without its items',
      (file: TrainingLibraryExport) => ({
        ...file,
        libraries: [{ library: { id: 1, name: 'A' } }],
      }),
    ],
    [
      'a plan without its anchor',
      (file: TrainingLibraryExport) => ({
        ...file,
        plans: [{ ...file.plans[0], plan_first_day: undefined }],
      }),
    ],
    [
      'a malformed plan anchor',
      (file: TrainingLibraryExport) => ({
        ...file,
        plans: [{ ...file.plans[0], plan_first_day: '6 March 2024' }],
      }),
    ],
  ])('rejects %s', (_label, mutate) => {
    expect(validate(mutate(sampleFile()))).toBe(false);
  });
});
