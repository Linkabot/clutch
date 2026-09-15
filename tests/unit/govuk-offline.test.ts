// Unit test for the offline cache-miss guard in scripts/lib/govuk.ts: with
// CLUTCH_OFFLINE=1 and an empty temporary cache directory, fetchContentApi
// must reject before ever reaching the network, so CI and the offline
// comparator (scripts/compare-highway-code.ts, Step 2) can prove no
// request escapes to gov.uk.
// Depends on: vitest, node:fs, node:os, node:path, scripts/lib/govuk.ts.
// Depended on by: `npm test` (Vitest run).

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchContentApi } from '../../scripts/lib/govuk';

describe('fetchContentApi offline guard', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'clutch-govuk-offline-'));
    vi.stubEnv('CLUTCH_OFFLINE', '1');
  });

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects with "offline: cache miss" and never calls fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(fetchContentApi('/guidance/the-highway-code', { cacheDir })).rejects.toThrow(
      /^offline: cache miss/,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
