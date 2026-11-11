/**
 * Main world interceptor - runs in page's JavaScript context
 *
 * This script runs with world: "MAIN" in Manifest V3, bypassing CSP restrictions.
 * It intercepts fetch/XHR and uses postMessage to send the TrainingPeaks
 * bearer token to the isolated world.
 */

import { extractRequestInfo, toAbsoluteUrl } from './requestInfo';

const DEBUG = import.meta.env.DEV;
const log = (...args: unknown[]): void => {
  if (DEBUG) console.log('[TP Extension - MAIN World]', ...args);
};

/**
 * Detect TrainingPeaks API calls for either environment (production or sandbox),
 * so the bearer token is captured regardless of the active environment.
 */
function isTrainingPeaksApiUrl(url: string): boolean {
  return (
    url.includes('tpapi.trainingpeaks.com') ||
    url.includes('tpapi.sandbox.trainingpeaks.com')
  );
}

/**
 * Post a bearer token to the isolated world when it is a TrainingPeaks
 * encrypted token (`gAAAA…`) on a TrainingPeaks API call. JWT candidates
 * (`eyJ…`) and other hosts are ignored.
 */
function maybePostTrainingPeaksToken(
  authHeader: string | null | undefined,
  url: string
): void {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return;
  }

  const token = authHeader.substring(7);
  if (!token.startsWith('gAAAA') || !isTrainingPeaksApiUrl(url)) {
    log('  ⏭️ Skipping non-TrainingPeaks token candidate');
    return;
  }

  window.postMessage(
    {
      type: 'TP_TOKEN_FOUND',
      token,
      timestamp: Date.now(),
      source: 'trainingpeaks-extension-main',
    },
    // Pinned to the page's own origin: `'*'` would hand the token to any
    // frame or script that happens to be listening for a cross-origin post.
    window.location.origin
  );
  log('  ✅ Token posted');
}

log('🚀 Main world interceptor loading...');

const originalFetch = window.fetch;

window.fetch = function (...args) {
  const { urlStr: rawUrl, headers } = extractRequestInfo(args[0], args[1]);
  // Resolve relative URLs against the page origin so host detection matches.
  const urlStr = toAbsoluteUrl(rawUrl, document.baseURI);

  maybePostTrainingPeaksToken(headers.get('authorization'), urlStr);

  return originalFetch.apply(this, args);
};

const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
const xhrHeaders = new WeakMap<XMLHttpRequest, Map<string, string>>();

XMLHttpRequest.prototype.setRequestHeader = function (
  header: string,
  value: string
) {
  if (!xhrHeaders.has(this)) {
    xhrHeaders.set(this, new Map());
  }
  xhrHeaders.get(this)!.set(header.toLowerCase(), value);

  return originalXHRSetRequestHeader.apply(this, [header, value]);
};

XMLHttpRequest.prototype.open = function (
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null
) {
  const xhrUrlAbs = toAbsoluteUrl(url.toString(), document.baseURI);

  this.addEventListener('loadstart', function () {
    maybePostTrainingPeaksToken(
      xhrHeaders.get(this)?.get('authorization'),
      xhrUrlAbs
    );
  });

  return originalXHROpen.call(
    this,
    method,
    url,
    async ?? true,
    username,
    password
  );
};

log('✅ Interceptors installed in MAIN world (bypassed CSP)');

export {};
