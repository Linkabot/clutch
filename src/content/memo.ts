// A tiny promise cache keyed by an arbitrary key: memoises the promise a
// factory returns so concurrent and later callers share one in-flight or
// settled result, but evicts a rejected promise so the next get() retries
// the factory instead of replaying the same failure forever (plan.md C-S1).
// Depends on: nothing.
// Depended on by: src/content/loaders.ts (per-section cache),
// src/content/signs.ts (signs.json cache), src/features/code/search.ts
// (search-index cache), tests/unit/memo.test.ts.

/** A memoised async value keyed by K, with retry-on-rejection. */
export interface PromiseCache<K, V> {
  /**
   * Returns the cached promise for `key`, calling `factory()` and caching
   * its result only if `key` has no entry yet. If the cached promise
   * rejects, it is removed from the cache so the next get() for the same
   * key calls `factory()` again instead of replaying the rejection.
   */
  get(key: K, factory: () => Promise<V>): Promise<V>;
  /** Discards every cached entry; in-flight promises still settle for callers already holding them. */
  clear(): void;
}

/** Creates an empty PromiseCache. See PromiseCache for the retry-on-rejection contract. */
export function createPromiseCache<K, V>(): PromiseCache<K, V> {
  let entries = new Map<K, Promise<V>>();

  return {
    get(key, factory) {
      const cached = entries.get(key);
      if (cached) return cached;

      const created = factory();
      entries.set(key, created);
      created.catch(() => {
        // Only evict if `entries` still holds this exact promise for this
        // key: a clear() (or a clear() + fresh get()) between the factory
        // call and now must not let this older rejection delete a newer,
        // unrelated entry. Returning here (rather than re-throwing) keeps
        // this a handled rejection; the promise returned to callers below
        // is `created` itself, so they still observe the rejection.
        if (entries.get(key) === created) {
          entries.delete(key);
        }
      });
      return created;
    },
    clear() {
      entries = new Map();
    },
  };
}
