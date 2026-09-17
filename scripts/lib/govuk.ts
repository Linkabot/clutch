// Polite helper for gov.uk: waits `delayMs` before every request, retries a
// 429 or 5xx response with backoff, and caches each raw response to disk so
// re-running an ingestion script never re-fetches a page it already has.
// This is the only module in the repo that calls the fetch API ("Rules that
// apply to every step" in plan.md restricts network access to the
// ingestion scripts, and they only reach gov.uk through here). When
// `process.env.CLUTCH_OFFLINE === '1'`, a cache miss throws `offline: cache
// miss for <basePath>`/`<url>` instead of ever reaching the network, so the
// offline comparator (Step 2), Step 14's own check and CI can all prove no
// request escapes to gov.uk. `fetchContentApi` fetches one gov.uk Content
// API page by its base path, caching under a whole `cacheDir`;
// `fetchCachedText`/`fetchCachedBytes` (Step 14) fetch any other gov.uk URL
// — a rendered chapter page, a picture's SVG bytes — each to one exact
// `cachePath` the caller names, with the same politeness, retry and offline
// rules.
// Depends on: Node's built-in `fs` and `path` modules, the global fetch API.
// Depended on by: scripts/ingest-national-standard.ts, scripts/ingest-signs.ts,
// scripts/lib/highway-code-build.ts (the only path by which the Highway Code
// ingest and comparison scripts reach gov.uk), scripts/verify-signs.ts,
// tests/unit/govuk-offline.test.ts.

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

  if (process.env.CLUTCH_OFFLINE === '1') {
    throw new Error(`offline: cache miss for ${basePath}`);
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

export interface FetchCachedOptions {
  /** Milliseconds to wait before making the request. Skipped entirely on a cache hit. */
  delayMs?: number;
  userAgent?: string;
  /** Retries on a 429 or 5xx response, in addition to the first attempt. */
  retries?: number;
}

/** Requests `url` with the same delay/retry/backoff policy as
 * `fetchContentApi`, returning the raw `Response`. Only called once a cache
 * miss has already been confirmed not offline — never call this directly. */
async function requestWithRetry(url: string, opts: FetchCachedOptions): Promise<Response> {
  const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
  const retries = opts.retries ?? DEFAULT_RETRIES;

  await wait(delayMs);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, { headers: { 'User-Agent': userAgent } });
    if (response.ok) return response;

    const canRetry = isRetryableStatus(response.status) && attempt < retries;
    if (!canRetry) {
      throw new Error(`gov.uk request failed: ${response.status} ${url}`);
    }
    await wait(RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)]);
  }

  // Unreachable: every loop iteration above either returns or throws.
  throw new Error(`gov.uk request failed: exhausted retries for ${url}`);
}

/**
 * Fetches `url` as text and caches the result at the exact `cachePath`
 * given, reusing it on every later call instead of re-fetching. Under
 * `CLUTCH_OFFLINE=1`, a cache miss throws `offline: cache miss for <url>`
 * before ever reaching the network, same rule as `fetchContentApi`.
 */
export async function fetchCachedText(
  url: string,
  cachePath: string,
  opts: FetchCachedOptions = {},
): Promise<string> {
  if (existsSync(cachePath)) {
    return readFileSync(cachePath, 'utf8');
  }
  if (process.env.CLUTCH_OFFLINE === '1') {
    throw new Error(`offline: cache miss for ${url}`);
  }

  const response = await requestWithRetry(url, opts);
  const text = await response.text();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, text, 'utf8');
  return text;
}

/**
 * Fetches `url` as raw bytes and caches the result at the exact `cachePath`
 * given, reusing it on every later call instead of re-fetching. Under
 * `CLUTCH_OFFLINE=1`, a cache miss throws `offline: cache miss for <url>`
 * before ever reaching the network, same rule as `fetchContentApi`.
 */
export async function fetchCachedBytes(
  url: string,
  cachePath: string,
  opts: FetchCachedOptions = {},
): Promise<Buffer> {
  if (existsSync(cachePath)) {
    return readFileSync(cachePath);
  }
  if (process.env.CLUTCH_OFFLINE === '1') {
    throw new Error(`offline: cache miss for ${url}`);
  }

  const response = await requestWithRetry(url, opts);
  const buffer = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, buffer);
  return buffer;
}
