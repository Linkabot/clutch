// Unit tests for scripts/check-headers.mjs: each finding (NO-HEADER, NO-PARTS, MISSING-BY,
// MISSING-ON, SPURIOUS) and each allowance (barrels, as-text parentheticals, contrast words,
// a pragma block before a line-comment header, stylesheets, tests/ files), run on fixture
// trees written to a temp dir through the script's --root mode.
// Depends on: vitest, node:child_process, node:fs, node:os, node:path, node:url, and
// scripts/check-headers.mjs (run as a child process, not imported).
// Depended on by: `npm test` (Vitest run).

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../scripts/check-headers.mjs', import.meta.url));

// A fixture block-comment header with the given "Depends on" and "Depended on by" text.
function block(on: string, by: string): string {
  return `/*\n * Fixture.\n * Depends on: ${on}\n * Depended on by: ${by}\n */\n`;
}

// The same three-line fixture header, as `//` line comments.
function lines(on: string, by: string): string {
  return `// Fixture.\n// Depends on: ${on}\n// Depended on by: ${by}\n`;
}

// A one-line pragma block, built via concatenation so this file's own raw source never spells
// out the "environment" pragma word whole. Vitest scans a test file's raw source for that
// pragma (regardless of string vs. comment context) to pick the file's own test environment,
// and a literal match here would switch this whole file to jsdom.
const PRAGMA_BLOCK = '/** @vitest-envir' + 'onment jsdom */\n';

/** Writes `tree` under a fresh temp dir, runs the script against it with --root, and returns
 * its exit status and stdout split into lines (CRLF normalised, trailing whitespace trimmed). */
function run(tree: Record<string, string>): { status: number | null; lines: string[] } {
  const dir = mkdtempSync(join(tmpdir(), 'check-headers-'));
  try {
    for (const [relPath, content] of Object.entries(tree)) {
      const absPath = join(dir, ...relPath.split('/'));
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, content, 'utf8');
    }
    const result = spawnSync(process.execPath, [SCRIPT, '--root', dir], { encoding: 'utf8' });
    const stdout = result.stdout.replace(/\r\n/g, '\n').replace(/\s+$/, '');
    return { status: result.status, lines: stdout.split('\n') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('check-headers', () => {
  it('reports no findings and exits 0 on a true tree', () => {
    const result = run({
      'src/fx/alpha.ts':
        block('beta.ts', 'gamma.ts, tests/fx/alpha.test.ts') + "import { b } from './beta';\n",
      'src/fx/beta.ts': block('nothing', 'alpha.ts'),
      'src/fx/gamma.ts': block('alpha.ts', 'nothing') + "import { a } from './alpha';\n",
      'tests/fx/alpha.test.ts':
        lines('src/fx/alpha.ts.', '`npm test`.') + "import { a } from '../../src/fx/alpha';\n",
      'scripts/fx/tool.mjs': `#!/usr/bin/env node\n${lines('nothing', 'nothing')}console.log(1);\n`,
    });
    expect(result.lines).toEqual(['check:headers: files 5, findings 0', 'check:headers: OK']);
    expect(result.status).toBe(0);
  });

  it('reports NO-HEADER for a file with no leading comment', () => {
    const result = run({ 'src/fx/alpha.ts': 'export const a = 1;\n' });
    expect(result.lines).toEqual([
      'NO-HEADER src/fx/alpha.ts',
      'check:headers: files 1, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('reports NO-PARTS when a header lacks Depends on or Depended on by', () => {
    const result = run({
      'src/fx/alpha.ts':
        '// Fixture.\n// Depends on: nothing.\n' + "import { g } from './gamma';\n",
      'src/fx/beta.ts': '// Fixture.\n// Depended on by: nothing.\n' + 'export const b = 1;\n',
      'src/fx/gamma.ts': block('nothing', 'alpha.ts'),
    });
    expect(result.lines).toEqual([
      'NO-PARTS src/fx/alpha.ts',
      'NO-PARTS src/fx/beta.ts',
      'check:headers: files 3, findings 2',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('reports MISSING-BY for an importer the header does not name', () => {
    const result = run({
      'src/fx/alpha.ts': block('beta.ts', 'nothing') + "import { b } from './beta';\n",
      'src/fx/beta.ts': block('nothing', 'nothing'),
      'src/fx/rho.ts': block('nothing', 'sigma.ts'),
      'tests/fx/sigma.test.ts':
        lines('src/fx/rho.ts', '`npm test`.') + "import { r } from '../../src/fx/rho';\n",
    });
    expect(result.lines).toEqual([
      'MISSING-BY src/fx/beta.ts <- src/fx/alpha.ts',
      'MISSING-BY src/fx/rho.ts <- tests/fx/sigma.test.ts',
      'check:headers: files 4, findings 2',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('reports MISSING-ON for a relative import the header does not name', () => {
    const result = run({
      'src/fx/alpha.ts': block('nothing', 'nothing') + "import { b } from './beta';\n",
      'src/fx/beta.ts': block('nothing', 'alpha.ts'),
      'src/fx/beta.tsx': block('nothing', 'nothing'),
    });
    expect(result.lines).toEqual([
      'MISSING-ON src/fx/alpha.ts -> src/fx/beta.ts',
      'check:headers: files 3, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('reports SPURIOUS for a named path that does not import the module', () => {
    const result = run({
      'src/fx/alpha.ts': block('nothing', 'nothing'),
      'src/fx/beta.ts': block('nothing', 'src/fx/alpha.ts, src/fx/omega.ts, src/fx/alpha.ts'),
    });
    expect(result.lines).toEqual([
      'SPURIOUS src/fx/beta.ts : src/fx/alpha.ts',
      'check:headers: files 2, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('reports SPURIOUS for an indirect dependent', () => {
    const result = run({
      'src/fx/alpha.ts': block('beta.ts', 'nothing') + "import { b } from './beta';\n",
      'src/fx/beta.ts': block('gamma.ts', 'alpha.ts') + "import { g } from './gamma';\n",
      'src/fx/gamma.ts': block('nothing', 'src/fx/beta.ts, src/fx/alpha.ts'),
    });
    expect(result.lines).toEqual([
      'SPURIOUS src/fx/gamma.ts : src/fx/alpha.ts',
      'check:headers: files 3, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('accepts a dependent that imports through a barrel', () => {
    const result = run({
      'src/fx/index.ts': block('alpha.ts', 'src/fy/beta.ts') + "export { a } from './alpha';\n",
      'src/fx/alpha.ts': block('nothing', 'src/fx/index.ts, src/fy/beta.ts, src/fy/gamma.ts'),
      'src/fy/beta.ts': block('the ../fx barrel', 'nothing') + "import { a } from '../fx';\n",
      'src/fy/gamma.ts': block('nothing', 'nothing'),
    });
    expect(result.lines).toEqual([
      'SPURIOUS src/fx/alpha.ts : src/fy/gamma.ts',
      'check:headers: files 4, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('exempts a barrel from MISSING-BY', () => {
    const result = run({
      'src/fx/index.ts':
        block('alpha.ts', 'whatever imports the fx folder') + "export * from './alpha';\n",
      'src/fx/alpha.ts': block('nothing', 'index.ts'),
      'src/fy/beta.ts': block('the ../fx barrel', 'nothing') + "import { a } from '../fx';\n",
      'src/fz/index.ts': block('nothing', 'nothing') + 'export const z = 1;\n',
      'src/fy/gamma.ts': block('the ../fz folder', 'nothing') + "import { z } from '../fz';\n",
    });
    expect(result.lines).toEqual([
      'MISSING-BY src/fz/index.ts <- src/fy/gamma.ts',
      'check:headers: files 5, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('allows a path followed by an as-text parenthetical', () => {
    const result = run({
      'scripts/fx/tool.mjs': lines('nothing', 'nothing') + 'console.log(1);\n',
      'src/fx/alpha.ts': block('nothing', 'scripts/fx/tool.mjs (manifest key,\n * read as text)'),
      'src/fx/beta.ts': block('nothing', 'scripts/fx/tool.mjs (reads this file)'),
    });
    expect(result.lines).toEqual([
      'SPURIOUS src/fx/beta.ts : scripts/fx/tool.mjs',
      'check:headers: files 3, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('allows a path after a contrast word', () => {
    const result = run({
      'scripts/fx/tool.mjs': lines('nothing', 'nothing') + 'console.log(1);\n',
      'src/fx/alpha.ts': block('nothing', 'nothing imports it; it is run by scripts/fx/tool.mjs'),
      'src/fx/gamma.ts': block('nothing', 'reached via scripts/fx/tool.mjs'),
      'src/fx/beta.ts': block('nothing', 'scripts/fx/tool.mjs'),
      'src/fx/delta.ts': block(
        'nothing',
        'read from scripts/fx/tool.mjs, other than scripts/fx/tool.mjs, ' +
          'like scripts/fx/tool.mjs, not scripts/fx/tool.mjs, never scripts/fx/tool.mjs, ' +
          'unlike scripts/fx/tool.mjs, through scripts/fx/tool.mjs, one of scripts/fx/tool.mjs, ' +
          'in scripts/fx/tool.mjs',
      ),
    });
    expect(result.lines).toEqual([
      'SPURIOUS src/fx/beta.ts : scripts/fx/tool.mjs',
      'check:headers: files 5, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('reads a pragma block followed by a line-comment header as one header', () => {
    const result = run({
      'src/fx/alpha.ts': block('nothing', 'tests/fx/alpha.test.ts, tests/fx/beta.test.ts'),
      'tests/fx/alpha.test.ts':
        PRAGMA_BLOCK +
        lines('src/fx/alpha.ts.', '`npm test`.') +
        "import { a } from '../../src/fx/alpha';\n",
      'tests/fx/beta.test.ts': PRAGMA_BLOCK + "import { a } from '../../src/fx/alpha';\n",
    });
    expect(result.lines).toEqual([
      'NO-PARTS tests/fx/beta.test.ts',
      'check:headers: files 3, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('ends the header at the comment unit holding Depended on by', () => {
    const result = run({
      'src/fx/alpha.ts':
        block('nothing', 'nothing') + '// Note: src/fx/beta.ts is its twin.\nexport const a = 1;\n',
      'src/fx/beta.ts': block('nothing', 'nothing'),
      'src/fx/gamma.ts':
        '// Fixture.\n// Depends on: nothing.\n\n// Depended on by: src/fx/beta.ts.\nexport const g = 1;\n',
    });
    expect(result.lines).toEqual([
      'SPURIOUS src/fx/gamma.ts : src/fx/beta.ts',
      'check:headers: files 3, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('strips whole-line line comments before block comments', () => {
    const result = run({
      'src/fx/alpha.ts':
        block('nothing', 'nothing') +
        "// Routes under /practice/* land here.\nimport { b } from './beta';\n/* import { g } from './gamma'; */\nexport const a = b;\n",
      'src/fx/beta.ts': block('nothing', 'alpha.ts'),
      'src/fx/gamma.ts': block('nothing', 'nothing'),
    });
    expect(result.lines).toEqual([
      'MISSING-ON src/fx/alpha.ts -> src/fx/beta.ts',
      'check:headers: files 3, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('counts every import form', () => {
    const importLines = [
      "import { b } from '../../src/fx/beta';",
      "import type { G } from '../../src/fx/gamma';",
      "import '../../src/fx/delta.css';",
      "const e = () => import('../../src/fx/epsilon');",
      "vi.mock('../../src/fx/zeta', () => ({}));",
      "type Eta = typeof import('../../src/fx/eta');",
      "export { theta } from '../../src/fx/theta';",
      "import data from '../../src/fx/iota.json';",
      "import raw from '../../src/fx/kappa.ts?raw';",
    ].join('\n');
    const result = run({
      'tests/fx/alpha.test.tsx': lines('nothing', '`npm test`.') + importLines + '\n',
      'src/fx/beta.ts': block('nothing', 'tests/fx/alpha.test.tsx'),
      'src/fx/gamma.ts': block('nothing', 'tests/fx/alpha.test.tsx'),
      'src/fx/epsilon.ts': block('nothing', 'tests/fx/alpha.test.tsx'),
      'src/fx/zeta.ts': block('nothing', 'tests/fx/alpha.test.tsx'),
      'src/fx/eta.ts': block('nothing', 'tests/fx/alpha.test.tsx'),
      'src/fx/theta.ts': block('nothing', 'tests/fx/alpha.test.tsx'),
      'src/fx/kappa.ts': block('nothing', 'nothing'),
      'src/fx/delta.css':
        block('nothing', 'tests/fx/alpha.test.tsx') + "@import url('./lambda.css');\n",
      'src/fx/lambda.css': block('nothing', 'delta.css'),
      'src/fx/iota.json': '{}\n',
    });
    expect(result.lines).toEqual([
      'MISSING-ON src/fx/delta.css -> src/fx/lambda.css',
      'MISSING-ON tests/fx/alpha.test.tsx -> src/fx/beta.ts',
      'MISSING-ON tests/fx/alpha.test.tsx -> src/fx/delta.css',
      'MISSING-ON tests/fx/alpha.test.tsx -> src/fx/epsilon.ts',
      'MISSING-ON tests/fx/alpha.test.tsx -> src/fx/eta.ts',
      'MISSING-ON tests/fx/alpha.test.tsx -> src/fx/gamma.ts',
      'MISSING-ON tests/fx/alpha.test.tsx -> src/fx/theta.ts',
      'MISSING-ON tests/fx/alpha.test.tsx -> src/fx/zeta.ts',
      'check:headers: files 10, findings 8',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('names a file by basename, word-bounded stem, folder, glob and barrel folder', () => {
    const onPart =
      'beta.ts, Gamma, mu-nu.ts, src/fx/deep/, src/fx/glob/*.ts, the /bar barrel, in alphabetical order.';
    const importLines = [
      "import '../../src/fx/beta';",
      "import '../../src/fx/Gamma';",
      "import '../../src/fx/deep/delta';",
      "import '../../src/fx/glob/epsilon';",
      "import '../../src/fx/bar';",
      "import '../../src/fx/mu';",
      "import '../../src/fx/nu';",
      "import '../../src/fx/alphabet';",
    ].join('\n');
    const result = run({
      'tests/fx/alpha.test.ts': lines(onPart, '`npm test`.') + importLines + '\n',
      'src/fx/beta.ts': block('nothing', 'tests/fx/'),
      'src/fx/Gamma.tsx': block('nothing', 'tests/fx/'),
      'src/fx/deep/delta.ts': block('nothing', 'tests/fx/'),
      'src/fx/glob/epsilon.ts': block('nothing', 'tests/fx/'),
      'src/fx/alphabet.ts': block('nothing', 'tests/fx/'),
      'src/fx/mu.ts': block('nothing', 'tests/fx/'),
      'src/fx/nu.ts': block('nothing', 'tests/fx/'),
      'src/fx/bar/index.ts': block('zeta.ts', 'tests/fx/') + "export * from './zeta';\n",
      'src/fx/bar/zeta.ts': block('nothing', 'index.ts'),
    });
    expect(result.lines).toEqual([
      'MISSING-ON tests/fx/alpha.test.ts -> src/fx/alphabet.ts',
      'MISSING-ON tests/fx/alpha.test.ts -> src/fx/mu.ts',
      'MISSING-ON tests/fx/alpha.test.ts -> src/fx/nu.ts',
      'check:headers: files 10, findings 3',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('judges stylesheets for MISSING-BY but never for SPURIOUS', () => {
    const result = run({
      'src/fx/alpha.css': block('nothing', 'src/fx/beta.tsx, src/fx/gamma.tsx'),
      'src/fx/beta.tsx': block('alpha.css', 'nothing') + "import './alpha.css';\n",
      'src/fx/gamma.tsx': block('nothing', 'nothing'),
      'src/fx/delta.tsx': block('alpha.css', 'nothing') + "import './alpha.css';\n",
    });
    expect(result.lines).toEqual([
      'MISSING-BY src/fx/alpha.css <- src/fx/delta.tsx',
      'check:headers: files 4, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });

  it('judges tests/ files only for their parts and Depends on', () => {
    const result = run({
      'tests/fx/omicron.ts': block('nothing', 'nothing'),
      'tests/fx/alpha.test.ts':
        lines('omicron.ts', 'src/fx/beta.ts') + "import { o } from './omicron';\n",
      'src/fx/beta.ts': block('nothing', 'nothing'),
      'tests/fx/gamma.test.ts': '// Fixture.\n// Depends on: nothing.\n' + 'export {};\n',
    });
    expect(result.lines).toEqual([
      'NO-PARTS tests/fx/gamma.test.ts',
      'check:headers: files 4, findings 1',
      'check:headers: FAIL',
    ]);
    expect(result.status).toBe(1);
  });
});
