// Checks WCAG 2.x contrast ratios for the Decision 13 colour tokens defined
// in src/app/theme.css, in both light and dark mode, and fails if any
// required foreground/background pair falls below 4.5:1 (AA, normal text)
// or a token a pair needs is missing from theme.css.
// Depends on: Node's built-in `fs`, `path`, `url` modules only (no deps);
// reads src/app/theme.css as plain text and parses its literal
// `--color-<name>: #RRGGBB` tokens (no var() indirection is expected).
// Depended on by: `npm run check:contrast` (package.json); the Step 2
// check in handoffs/phase-1-highway-code/plan.md.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEME_PATH = join(__dirname, '..', 'src', 'app', 'theme.css');

// Pairs checked in BOTH light and dark mode: [foreground token, background
// token]. Per amendment P1 (plan.md), sign-ink/marking-yellow replaces
// ink/marking-yellow and sign-ink/on-sign is added — Decision 13 signage
// keeps its own dark "ink" colour in both colour schemes, so it is checked
// on its own rather than via the mode-dependent --color-ink.
const PAIRS = [
  ['ink', 'page'],
  ['ink', 'surface'],
  ['muted', 'page'],
  ['muted', 'surface'],
  ['tab-inactive', 'tab-bar'],
  ['tab-active', 'tab-bar'],
  ['on-sign', 'sign-blue'],
  ['on-sign', 'sign-green'],
  ['on-sign', 'sign-red'],
  ['sign-ink', 'marking-yellow'],
  ['sign-ink', 'on-sign'],
  ['link', 'page'],
  ['link', 'surface'],
];

const MIN_RATIO = 4.5;

function parseTokens(blockText) {
  const tokens = {};
  const re = /--color-([a-z0-9-]+)\s*:\s*#([0-9a-fA-F]{6})\b/g;
  let match;
  while ((match = re.exec(blockText)) !== null) {
    tokens[match[1]] = `#${match[2].toLowerCase()}`;
  }
  return tokens;
}

function srgbChannelToLinear(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const [rl, gl, bl] = [r, g, b].map(srgbChannelToLinear);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

const css = readFileSync(THEME_PATH, 'utf8');
const rootBlocks = [...css.matchAll(/:root\s*\{([^}]*)\}/g)];
if (rootBlocks.length < 2) {
  console.error(
    `expected two :root blocks in ${THEME_PATH} (light and dark), found ${rootBlocks.length}`,
  );
  process.exit(1);
}

const light = parseTokens(rootBlocks[0][1]);
const darkOverrides = parseTokens(rootBlocks[1][1]);
const dark = { ...light, ...darkOverrides };
const modes = { light, dark };

const rows = [];
let failed = false;

for (const [modeName, tokens] of Object.entries(modes)) {
  for (const [fg, bg] of PAIRS) {
    const fgHex = tokens[fg];
    const bgHex = tokens[bg];
    if (!fgHex || !bgHex) {
      const missing = !fgHex ? fg : bg;
      rows.push({
        mode: modeName,
        pair: `${fg}/${bg}`,
        ratio: 'n/a',
        result: `FAIL (missing token: ${missing})`,
      });
      failed = true;
      continue;
    }
    const ratio = contrastRatio(fgHex, bgHex);
    const pass = ratio >= MIN_RATIO;
    if (!pass) failed = true;
    rows.push({
      mode: modeName,
      pair: `${fg}/${bg}`,
      ratio: ratio.toFixed(2),
      result: pass ? 'PASS' : 'FAIL',
    });
  }
}

const modeW = Math.max(4, ...rows.map((r) => r.mode.length));
const pairW = Math.max(4, ...rows.map((r) => r.pair.length));
const ratioW = Math.max(5, ...rows.map((r) => r.ratio.length));

console.log(`${'mode'.padEnd(modeW)}  ${'pair'.padEnd(pairW)}  ${'ratio'.padEnd(ratioW)}  result`);
for (const r of rows) {
  console.log(
    `${r.mode.padEnd(modeW)}  ${r.pair.padEnd(pairW)}  ${r.ratio.padEnd(ratioW)}  ${r.result}`,
  );
}

if (failed) {
  console.error(`\ncontrast check FAILED (minimum ratio ${MIN_RATIO}:1)`);
  process.exit(1);
}

console.log(`\nall pairs pass ${MIN_RATIO}:1 in both light and dark mode`);
