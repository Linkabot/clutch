// Unit tests for displayName() and gameName() (src/content/signs.ts):
// displayName trims exactly one trailing full stop from a sign's raw name;
// gameName substitutes the Highway Code short names for the two
// LOOK_ALIKE_PAIR signs (STOP and GIVE WAY, Q7) and falls back to
// displayName for every other sign. The two short names are checked
// against the real committed
// content/uk/highway-code/sections/traffic-signs.json, so a typo in either
// string cannot go unnoticed.
// Depends on: vitest, node:fs, node:path, node:url, src/content/signs.ts.
// Depended on by: `npm test` (Vitest run).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { displayName, gameName, GAME_NAMES } from '../../src/content/signs';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('displayName', () => {
  it('trims exactly one trailing full stop', () => {
    expect(displayName({ name: 'Crossroads.' })).toBe('Crossroads');
    expect(displayName({ name: 'A.' })).toBe('A');
  });

  it('leaves a name with no trailing stop unchanged', () => {
    expect(displayName({ name: 'No stop' })).toBe('No stop');
  });

  it('trims only one trailing stop, leaving the other', () => {
    expect(displayName({ name: 'Two..' })).toBe('Two.');
  });
});

describe('gameName', () => {
  it('gives the Highway Code short name for STOP', () => {
    expect(
      gameName({
        id: 'orders-stop-sign-and-road-marking',
        name: "The 'STOP' sign and road markings",
      }),
    ).toBe('Stop and give way');
  });

  it('gives the Highway Code short name for GIVE WAY', () => {
    expect(
      gameName({
        id: 'orders-give-way-road-marking',
        name: "The 'GIVE WAY' sign and road markings",
      }),
    ).toBe('Give way to traffic on major road');
  });

  it('falls back to displayName for every other sign', () => {
    expect(gameName({ id: 'warning-crossroads', name: 'Crossroads.' })).toBe('Crossroads');
  });

  it("the two short names each appear in traffic-signs.json's diagram links", () => {
    const traffic = JSON.parse(
      readFileSync(
        join(
          __dirname,
          '..',
          '..',
          'content',
          'uk',
          'highway-code',
          'sections',
          'traffic-signs.json',
        ),
        'utf8',
      ),
    ) as { bodyHtml: string };

    expect(traffic.bodyHtml).toContain('↗ Stop and give way (diagram, online)');
    expect(traffic.bodyHtml).toContain('↗ Give way to traffic on major road (diagram, online)');
    expect(traffic.bodyHtml).toContain(GAME_NAMES['orders-stop-sign-and-road-marking']);
    expect(traffic.bodyHtml).toContain(GAME_NAMES['orders-give-way-road-marking']);
  });
});
