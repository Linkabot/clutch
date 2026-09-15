// Structural diff between two parsed JSON values: walks objects and arrays
// together and returns the list of JSON paths whose leaf values differ.
// Object keys are compared as a union of both sides (a key present on only
// one side counts as a difference at that key's path); array items are
// compared by index, never by identity or a key inside them, so an item
// added, removed or reordered shows up as a difference at the index it
// moved through. Pure, synchronous and dependency-free.
// Depends on: nothing (plain JS/TS only).
// Depended on by: scripts/compare-highway-code.ts, tests/unit/json-diff.test.ts.

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function diffAt(path: string, a: unknown, b: unknown, out: string[]): void {
  if (Object.is(a, b)) return;

  if (Array.isArray(a) && Array.isArray(b)) {
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
      const childPath = `${path}[${i}]`;
      if (i >= a.length || i >= b.length) {
        out.push(childPath);
        continue;
      }
      diffAt(childPath, a[i], b[i], out);
    }
    return;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) {
        out.push(childPath);
        continue;
      }
      diffAt(childPath, a[key], b[key], out);
    }
    return;
  }

  // Either two unequal primitives, or a type mismatch (array vs object,
  // object vs primitive, etc.) — either way this node itself is the leaf
  // difference; nothing more to recurse into.
  out.push(path);
}

/**
 * Returns the JSON paths whose leaf values differ between `a` and `b`
 * (e.g. `"section.title"`, `"rules[2].crossRefs[0]"`). Equal input of any
 * shape returns `[]`.
 */
export function diffJson(a: unknown, b: unknown): string[] {
  const out: string[] = [];
  diffAt('', a, b, out);
  return out;
}
