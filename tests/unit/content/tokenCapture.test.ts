// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://app.trainingpeaks.com/home"}
/**
 * The TrainingPeaks token hops from the page's MAIN world to the isolated
 * bridge over `window.postMessage`. Both ends are pinned to the page origin so
 * the token is never offered to another origin and a foreign post is ignored.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const PAGE_ORIGIN = 'https://app.trainingpeaks.com';
const TOKEN_MESSAGE = {
  type: 'TP_TOKEN_FOUND',
  token: 'gAAAA-fresh',
  timestamp: 1,
  source: 'trainingpeaks-extension-main',
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined as never);
});

describe('mainWorldInterceptor', () => {
  it('posts the captured token to the page origin, not to any origin', async () => {
    const originalFetch = vi.fn().mockResolvedValue(new Response('{}'));
    window.fetch = originalFetch as typeof window.fetch;
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => {});
    await import('@/content/mainWorldInterceptor');

    await window.fetch('https://tpapi.trainingpeaks.com/users/v3/user', {
      headers: { authorization: 'Bearer gAAAA-fresh' },
    });

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TP_TOKEN_FOUND', token: 'gAAAA-fresh' }),
      PAGE_ORIGIN
    );
    expect(originalFetch).toHaveBeenCalledTimes(1);
  });

  it('does not post a token for a non-TrainingPeaks host or a JWT', async () => {
    window.fetch = vi
      .fn()
      .mockResolvedValue(new Response('{}')) as typeof window.fetch;
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => {});
    await import('@/content/mainWorldInterceptor');

    await window.fetch('https://example.com/x', {
      headers: { authorization: 'Bearer gAAAA-fresh' },
    });
    await window.fetch('https://tpapi.trainingpeaks.com/x', {
      headers: { authorization: 'Bearer eyJ.jwt.token' },
    });

    expect(postMessage).not.toHaveBeenCalled();
  });
});

describe('isolatedWorldBridge', () => {
  function post(init: MessageEventInit): void {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: TOKEN_MESSAGE,
        origin: PAGE_ORIGIN,
        source: window,
        ...init,
      })
    );
  }

  beforeEach(async () => {
    await import('@/content/isolatedWorldBridge');
  });

  it('forwards a token posted by the page itself', () => {
    post({});

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'TOKEN_FOUND',
      token: 'gAAAA-fresh',
      timestamp: 1,
    });
  });

  it('ignores a message from another origin', () => {
    post({ origin: 'https://evil.test' });

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('ignores a message that did not come from the page window', () => {
    post({ source: null });

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('ignores another source marker and other types', () => {
    post({ data: { ...TOKEN_MESSAGE, source: 'someone-else' } });
    post({ data: { ...TOKEN_MESSAGE, type: 'OTHER' } });
    post({ data: null });

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});
