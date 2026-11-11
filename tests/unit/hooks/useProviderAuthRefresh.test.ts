import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useProviderAuthRefresh } from '@/hooks/useProviderAuthRefresh';
import { requestTrainingPeaksAuthRefresh } from '@/utils/trainingPeaksTab';

describe('auth refresh wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the refresh message and returns the verdict', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      outcome: 'refreshed',
    });

    await expect(requestTrainingPeaksAuthRefresh()).resolves.toEqual({
      outcome: 'refreshed',
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'REFRESH_PROVIDER_AUTH',
      provider: 'trainingpeaks',
    });
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
  });

  it('turn a messaging failure into an error outcome', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValueOnce(
      new Error('Receiving end does not exist')
    );

    await expect(requestTrainingPeaksAuthRefresh()).resolves.toEqual({
      outcome: 'error',
      error: 'Receiving end does not exist',
    });
  });
});

describe('useProviderAuthRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('tracks the in-flight state and the final verdict without any timer', async () => {
    let resolveRequest!: (value: unknown) => void;
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }) as never
    );
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const { result } = renderHook(() =>
      useProviderAuthRefresh('trainingpeaks')
    );
    expect(result.current.status).toBe('idle');
    expect(result.current.message).toBeNull();

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.refresh();
    });
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.message).toMatch(/background tab/);

    await act(async () => {
      resolveRequest({ outcome: 'sign_in_required', tabId: 7 });
      await pending;
    });

    expect(result.current.status).toBe('sign_in_required');
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.message).toMatch(/Sign in to TrainingPeaks/);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });

  it('includes the background error text and can be reset', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({
      outcome: 'error',
      error: 'No browser window',
    });

    const { result } = renderHook(() =>
      useProviderAuthRefresh('trainingpeaks')
    );

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.message).toBe(
      'Could not refresh TrainingPeaks sign-in (No browser window)'
    );

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.message).toBeNull();
  });
});
