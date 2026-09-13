// Unit tests for the pure National Standard parser: unit/element boundaries
// and the two requirement lists against the fixture
// (tests/fixtures/national-standard-role.html), plus regression cases for
// the two markup quirks found on the live pages (an element heading
// published without its colon, and a requirement item whose nested
// sub-list must flatten into that item's own text).
// Depends on: vitest, node:fs, node:url, node:path,
// scripts/lib/national-standard-parse.ts, src/content/schemas/syllabus.ts.
// Depended on by: `npm test` (Vitest run).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseRolePage } from '../../scripts/lib/national-standard-parse';
import { SyllabusRoleSchema } from '../../src/content/schemas/syllabus';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'national-standard-role.html'),
  'utf8',
);

describe('parseRolePage', () => {
  const role = parseRolePage(fixtureHtml, {
    title: 'Role 4: Drive safely and responsibly in the traffic system',
  });

  it('parses cleanly against SyllabusRoleSchema', () => {
    expect(() => SyllabusRoleSchema.parse(role)).not.toThrow();
  });

  it('splits the role heading into id and title', () => {
    expect(role.id).toBe('4');
    expect(role.title).toBe('Drive safely and responsibly in the traffic system');
  });

  it('finds exactly one unit', () => {
    expect(role.units).toHaveLength(1);
  });

  describe('Unit 4.1', () => {
    const unit = role.units[0];

    it('splits the unit heading into id and title', () => {
      expect(unit.id).toBe('4.1');
      expect(unit.title).toBe('Interact correctly with other road users');
    });

    it('finds both elements, in order, and drops the front-matter link list', () => {
      expect(unit.elements.map((element) => element.id)).toEqual(['4.1.1', '4.1.2']);
    });
  });

  describe('Element 4.1.1', () => {
    const element = role.units[0].elements[0];

    it('splits the element heading into id and title', () => {
      expect(element.title).toBe('Communicate intentions to other road users');
    });

    it('reads mustBeAbleTo from the list after "Performance standards"', () => {
      expect(element.mustBeAbleTo).toEqual([
        'use indicators and arm signals to signal intentions correctly',
        'support the use of any signals given by positioning the vehicle correctly and safely',
        'use horn and lights to communicate with other road users where necessary',
      ]);
    });

    it('reads mustKnow from the list after "Knowledge and understanding requirements"', () => {
      expect(element.mustKnow).toHaveLength(10);
      expect(element.mustKnow[0]).toBe(
        'the arm signals shown in The Highway Code and when they may need to be given',
      );
    });
  });

  describe('Element 4.1.2', () => {
    const element = role.units[0].elements[1];

    it('splits the element heading into id and title', () => {
      expect(element.title).toBe('Co-operate with other road users');
    });

    it('reads both requirement lists', () => {
      expect(element.mustBeAbleTo).toHaveLength(5);
      expect(element.mustKnow).toHaveLength(9);
    });
  });
});

describe('parseRolePage regression: markup quirks found on the live pages', () => {
  it('splits an element heading published without its colon (Element 1.3.1, 5.1.1 on the live site)', () => {
    const html = `
      <h2 id="unit-99">Unit 9.9: Fixture unit</h2>
      <h3 id="element-99">Element 9.9.1 Fixture element without a colon</h3>
      <h4>Performance standards</h4>
      <p>You must be able to:</p>
      <ul><li>do the fixture thing</li></ul>
      <h4>Knowledge and understanding requirements</h4>
      <p>You must know and understand:</p>
      <ul><li>know the fixture thing</li></ul>
    `;
    const role = parseRolePage(html, { title: 'Role 9: Fixture role' });
    const element = role.units[0].elements[0];
    expect(element.id).toBe('9.9.1');
    expect(element.title).toBe('Fixture element without a colon');
  });

  it("flattens a nested sub-list inside a requirement item into that item's own text (as on Element 1.1.2 on the live site)", () => {
    const html = `
      <h2 id="unit-99">Unit 9.9: Fixture unit</h2>
      <h3 id="element-99">Element 9.9.1: Fixture element</h3>
      <h4>Performance standards</h4>
      <p>You must be able to:</p>
      <ul>
        <li>plan a suitable route taking into account:
          <ul>
            <li>road conditions</li>
            <li>weather conditions</li>
          </ul>
        </li>
      </ul>
      <h4>Knowledge and understanding requirements</h4>
      <p>You must know and understand:</p>
      <ul><li>know the fixture thing</li></ul>
    `;
    const role = parseRolePage(html, { title: 'Role 9: Fixture role' });
    const element = role.units[0].elements[0];
    expect(element.mustBeAbleTo).toEqual([
      'plan a suitable route taking into account: road conditions weather conditions',
    ]);
  });
});
