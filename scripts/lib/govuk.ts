// Polite helper for the gov.uk Content API: waits `delayMs` before every
// request, retries a 429 or 5xx response with backoff, and — when a
// `cacheDir` is given — caches each raw response to disk so re-running an
// ingestion script never re-fetches a page it already has. This is the only
// module in the repo that calls the fetch API ("Rules that apply to every
// step" in plan.md restricts network access to the two ingestion scripts,
// and they only reach gov.uk through here).
// Depends on: Node's built-in `fs` and `path` modules, the global fetch API.
// Depended on by: scripts/ingest-highway-code.ts (Step 9),
// scripts/ingest-national-standard.ts (Step 10).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const CONTENT_API_ROOT = 'https://www.gov.uk/api/content';
const DEFAULT_DELAY_MS = 600;
const DEFAULT_USER_AGENT = 'clutch-ingest/0.1 (+https://linkabot.github.io/clutch/)';
const DEFAULT_RETRIES = 3;
const RETRY_BACKOFF_MS = [2000, 4000, 8000];

export interface FetchContentApiOptions {
  /** Milliseconds to wait before making the request. Skipped entirely on a cache hit. */
  delayMs?: number;
  userAgent?: string;
  /** Retries on a 429 or 5xx response, in addition to the first attempt. */
  retries?: number;
  /** When set, raw responses are cached under this directory and reused on later runs. */
  cacheDir?: string;
}

function cacheFilePath(cacheDir: string, basePath: string): string {
  return join(cacheDir, `${encodeURIComponent(basePath)}.json`);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches `https://www.gov.uk/api/content<basePath>` and returns the parsed
 * JSON body. Intended for sequential use only — the ingestion scripts fetch
 * one page at a time, in order, never in parallel — so `delayMs` between
 * calls stays an honest gap between real requests to gov.uk.
 */
export async function fetchContentApi(
  basePath: string,
  opts: FetchContentApiOptions = {},
): Promise<unknown> {
  const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const cachePath = opts.cacheDir ? cacheFilePath(opts.cacheDir, basePath) : null;

  if (cachePath && existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, 'utf8')) as unknown;
  }

  await wait(delayMs);

  const url = `${CONTENT_API_ROOT}${basePath}`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
    });

    if (response.ok) {
      const text = await response.text();
      if (cachePath) {
        mkdirSync(dirname(cachePath), { recursive: true });
        writeFileSync(cachePath, text, 'utf8');
      }
      return JSON.parse(text) as unknown;
    }

    const canRetry = isRetryableStatus(response.status) && attempt < retries;
    if (!canRetry) {
      throw new Error(`gov.uk content API request failed: ${response.status} ${url}`);
    }
    await wait(RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)]);
  }

  // Unreachable: every loop iteration above either returns or throws.
  throw new Error(`gov.uk content API request failed: exhausted retries for ${url}`);
}
