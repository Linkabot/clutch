// Unit tests for src/content/memo.ts's PromiseCache: a rejected promise is
// evicted so the next get() retries the factory (plan.md C-S1), a resolved
// promise stays cached (the factory runs once), and evicting a rejection
// never removes a different, later promise held under the same key.
// Depends on: vitest, src/content/memo.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect, vi } from 'vitest';
import { createPromiseCache } from '../../src/content/memo';

describe('createPromiseCache', () => {
  it('retries the factory after a rejection, then caches the resolution', async () => {
    const cache = createPromiseCache<string, number>();
    const factory = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(42);

    await expect(cache.get('key', factory)).rejects.toThrow('boom');
    await expect(cache.get('key', factory)).resolves.toBe(42);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('calls the factory once for two get()s on an already-resolved key', async () => {
    const cache = createPromiseCache<string, number>();
    const factory = vi.fn<() => Promise<number>>().mockResolvedValue(7);

    const [first, second] = await Promise.all([
      cache.get('key', factory),
      cache.get('key', factory),
    ]);

    expect(first).toBe(7);
    expect(second).toBe(7);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('does not evict a fresh entry left by clear() when an older rejection settles late', async () => {
    const cache = createPromiseCache<string, number>();
    let rejectFirst: (error: Error) => void = () => {};
    const first = new Promise<number>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const firstFactory = vi.fn(() => first);
    const secondFactory = vi.fn<() => Promise<number>>().mockResolvedValue(99);

    const pendingGet = cache.get('key', firstFactory);
    pendingGet.catch(() => {}); // observed here so the rejection below is never unhandled

    cache.clear();
    const secondGet = cache.get('key', secondFactory);

    rejectFirst(new Error('late rejection'));
    await expect(pendingGet).rejects.toThrow('late rejection');
    await expect(secondGet).resolves.toBe(99);
    expect(secondFactory).toHaveBeenCalledTimes(1);

    // The fresh entry must still be cached: a third get() must not call
    // secondFactory again.
    await expect(cache.get('key', secondFactory)).resolves.toBe(99);
    expect(secondFactory).toHaveBeenCalledTimes(1);
  });
});
