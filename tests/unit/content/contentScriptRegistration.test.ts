/**
 * How the content scripts, host permissions and branding are registered.
 *
 * These are manifest facts rather than code paths, but they decide what the
 * extension can touch, so they are pinned here rather than left to review.
 */

import { describe, it, expect } from 'vitest';
import manifest from '../../../public/manifest.json';

interface ContentScript {
  js: string[];
  run_at?: string;
  world?: string;
  matches: string[];
}

const scripts = manifest.content_scripts as ContentScript[];

function scriptFor(source: string): ContentScript {
  const match = scripts.find((script) =>
    script.js.some((file) => file.endsWith(source))
  );
  if (!match) throw new Error(`No content script registered for ${source}`);
  return match;
}

describe('content script registration', () => {
  it('should register every content script at document_start', () => {
    // They observe page activity, so none of them may attach after the page has
    // started doing the thing being observed.
    for (const script of scripts) {
      expect(script.run_at).toBe('document_start');
    }
  });

  it('should capture the TrainingPeaks token only on TrainingPeaks app origins', () => {
    const tpOrigins = [
      'https://app.trainingpeaks.com/*',
      'https://app.sandbox.trainingpeaks.com/*',
    ];
    expect(scriptFor('mainWorldInterceptor.ts').matches).toEqual(tpOrigins);
    expect(scriptFor('isolatedWorldBridge.ts').matches).toEqual(tpOrigins);
  });

  it('should run the bridge in the isolated world', () => {
    // It forwards to the extension and must not be reachable by page scripts.
    expect(scriptFor('isolatedWorldBridge.ts').world).toBe('ISOLATED');
  });

  it('should inject nothing on any other site', () => {
    for (const script of scripts) {
      for (const pattern of script.matches) {
        expect(pattern).toMatch(/^https:\/\/app(\.sandbox)?\.trainingpeaks\.com\/\*$/);
      }
    }
  });
});

describe('requested permissions', () => {
  it('should request only the permissions the extension uses', () => {
    expect(manifest.permissions).toEqual(['storage', 'tabs']);
  });

  it('should reach only TrainingPeaks hosts', () => {
    for (const pattern of manifest.host_permissions) {
      expect(pattern).toMatch(/^https:\/\/[a-z.]*trainingpeaks\.com\/\*$/);
    }
  });
});

describe('branding', () => {
  it('should be named Training Library Exporter', () => {
    expect(manifest.name).toBe('Training Library Exporter');
    expect(manifest.short_name).toBe('Library Exporter');
  });

  it('should not name another product in its description', () => {
    expect(manifest.description).toBe(
      'Download your TrainingPeaks workout libraries and training plans to one JSON file'
    );
  });
});
