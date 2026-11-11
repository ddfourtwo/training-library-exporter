import { describe, expect, it } from 'vitest';
import {
  originFromUrl,
  trainingPeaksEnvironmentForApiOrigin,
  trainingPeaksEnvironmentForAppOrigin,
} from '@/utils/constants';

describe('trainingPeaksEnvironmentForAppOrigin', () => {
  it('maps the production and sandbox app origins', () => {
    expect(
      trainingPeaksEnvironmentForAppOrigin('https://app.trainingpeaks.com')
    ).toBe('production');
    expect(
      trainingPeaksEnvironmentForAppOrigin(
        'https://app.sandbox.trainingpeaks.com'
      )
    ).toBe('sandbox');
  });

  it('rejects lookalikes, paths and absent origins', () => {
    expect(
      trainingPeaksEnvironmentForAppOrigin(
        'https://app.trainingpeaks.com.evil.test'
      )
    ).toBeNull();
    expect(
      trainingPeaksEnvironmentForAppOrigin('https://app.trainingpeaks.com/x')
    ).toBeNull();
    expect(trainingPeaksEnvironmentForAppOrigin(null)).toBeNull();
    expect(trainingPeaksEnvironmentForAppOrigin(undefined)).toBeNull();
  });
});

describe('trainingPeaksEnvironmentForApiOrigin', () => {
  it('maps the production and sandbox API origins', () => {
    expect(
      trainingPeaksEnvironmentForApiOrigin('https://tpapi.trainingpeaks.com')
    ).toBe('production');
    expect(
      trainingPeaksEnvironmentForApiOrigin(
        'https://tpapi.sandbox.trainingpeaks.com'
      )
    ).toBe('sandbox');
  });

  it('rejects other origins', () => {
    expect(
      trainingPeaksEnvironmentForApiOrigin('https://example.com')
    ).toBeNull();
  });
});

describe('originFromUrl', () => {
  it('returns the origin of an absolute URL', () => {
    expect(originFromUrl('https://app.trainingpeaks.com/home?x=1')).toBe(
      'https://app.trainingpeaks.com'
    );
  });

  it('returns null for invalid or absent URLs', () => {
    expect(originFromUrl('not a url')).toBeNull();
    expect(originFromUrl(null)).toBeNull();
    expect(originFromUrl(undefined)).toBeNull();
  });
});
