// Unit tests for requestPersistentStorage (src/app/persist.ts, M16): a
// missing Navigator.storage.persist resolves false; a resolved persist()
// call is passed through, true or false (amendment E5); a rejected
// persist() call resolves false instead of throwing, without ever
// rejecting itself; and persist() is called exactly once per call. Node 24's own global `navigator` has no `storage`,
// so the default parameter is safe to exercise directly, but each fake-
// object case here passes its own object cast to Navigator to keep the
// assertions explicit.
// Depends on: vitest, src/app/persist.ts.
// Depended on by: `npm test` (Vitest run).
import { describe, it, expect, vi } from 'vitest';
import { requestPersistentStorage } from '../../src/app/persist';

describe('requestPersistentStorage', () => {
  it('returns false when storage.persist is not a function', async () => {
    const nav = {} as Navigator;
    await expect(requestPersistentStorage(nav)).resolves.toBe(false);
  });

  it('returns true when persist resolves true, calling it exactly once', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    const nav = { storage: { persist } } as unknown as Navigator;
    await expect(requestPersistentStorage(nav)).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  // E5: the browser may decline without rejecting; that false must pass
  // through, not be reported as success.
  it('returns false when persist resolves false, calling it exactly once', async () => {
    const persist = vi.fn().mockResolvedValue(false);
    const nav = { storage: { persist } } as unknown as Navigator;
    await expect(requestPersistentStorage(nav)).resolves.toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('returns false when persist rejects, calling it exactly once', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('denied'));
    const nav = { storage: { persist } } as unknown as Navigator;
    await expect(requestPersistentStorage(nav)).resolves.toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('uses the global navigator (no storage in the test environment) by default', async () => {
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});
