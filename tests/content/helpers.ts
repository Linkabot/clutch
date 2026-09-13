// Shared helpers for tests/content/*.test.ts: the absolute path to
// content/uk/ and a small JSON reader, so content tests validate the
// committed files directly rather than through Vite's import.meta.glob.
// Depends on: node:fs, node:path, node:url.
// Depended on by: tests/content/pack.test.ts and later content tests
// (Steps 9, 10, 11, 12, 14).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CONTENT_ROOT = join(__dirname, '..', '..', 'content', 'uk');

export function readJson<T = unknown>(relativePath: string): T {
  const fullPath = join(CONTENT_ROOT, relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf8')) as T;
}
