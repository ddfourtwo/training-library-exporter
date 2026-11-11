/**
 * Isolated world bridge - runs in extension's isolated context
 *
 * This script runs with world: "ISOLATED" (default) in Manifest V3.
 * It receives postMessage events from the main world interceptor
 * and forwards them to the background worker via chrome.runtime.
 */

const DEBUG = import.meta.env.DEV;
const log = (...args: unknown[]): void => {
  if (DEBUG) {
    console.log('[TP Extension - ISOLATED World]', ...args);
  }
};

/**
 * Listen for messages from the main world interceptor
 */
window.addEventListener('message', (event) => {
  // Only accept messages from same window, same origin and our extension
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  if (!event.data || event.data.source !== 'trainingpeaks-extension-main')
    return;
  if (event.data.type !== 'TP_TOKEN_FOUND') return;

  log('📨 Received TrainingPeaks token from MAIN world');

  chrome.runtime
    .sendMessage({
      type: 'TOKEN_FOUND',
      token: event.data.token,
      timestamp: event.data.timestamp,
    })
    .catch((error) => {
      log('❌ Failed to send token to background:', error);
    });
});

log('✅ Bridge loaded');

export {};
