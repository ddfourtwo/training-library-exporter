/**
 * The fork stays unbranded.
 *
 * This extension exists so a coach can move their own TrainingPeaks data into a
 * file without carrying another product's name, icon or origin. A single
 * "compatible with" line is enough to drift back into being a branded tool, so
 * the rule is machine-checked rather than left to review.
 *
 * The needle is assembled at runtime so this file can both live in the repo and
 * scan it without matching itself.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BRAND = ['beo', 'flow'].join('');

const ROOT = new URL('../../', import.meta.url).pathname;
const SCANNED = [
  'src',
  'public',
  'docs',
  'schema',
  'package.json',
  'README.md',
  'PRIVACY.md',
  'INSTALL.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'TESTING.md',
  'LICENSE',
];
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);

function files(path: string): string[] {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat) return [];
  if (stat.isFile()) return [path];
  return readdirSync(path).flatMap((entry) =>
    SKIPPED_DIRS.has(entry) ? [] : files(join(path, entry))
  );
}

describe('branding', () => {
  it('names no other product anywhere it ships or documents', () => {
    const offenders: string[] = [];
    for (const entry of SCANNED) {
      for (const file of files(join(ROOT, entry))) {
        if (readFileSync(file, 'utf8').toLowerCase().includes(BRAND)) {
          offenders.push(relative(ROOT, file));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
