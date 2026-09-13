// Content test: the ingested National Standard syllabus
// (content/uk/syllabus.json, written by `npm run ingest:national-standard`,
// Step 10) parses against SyllabusSchema and matches the shape a future
// syllabus screen would depend on — five roles numbered 1-5, a unit/element
// id tree that nests correctly and is unique throughout, a `counts` block
// that is an honest recount (not assumed from scout.md), and every element
// carrying at least one requirement.
// Depends on: vitest, src/content/schemas, tests/content/helpers.ts.
// Depended on by: `npm run validate:content` / `npm test`.
import { describe, it, expect } from 'vitest';
import { SyllabusSchema } from '../../src/content/schemas';
import type { Syllabus } from '../../src/content/schemas';
import { readJson } from './helpers';

describe('content/uk/syllabus.json', () => {
  const syllabus = readJson<Syllabus>('syllabus.json');

  it('parses against SyllabusSchema', () => {
    expect(() => SyllabusSchema.parse(syllabus)).not.toThrow();
  });

  it('has exactly 5 roles, one per role page fetched, numbered 1-5 in order', () => {
    expect(syllabus.roles).toHaveLength(5);
    expect(syllabus.roles.map((role) => role.id)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('every unit id starts with its role id, every element id starts with its unit id', () => {
    for (const role of syllabus.roles) {
      for (const unit of role.units) {
        expect(unit.id.startsWith(`${role.id}.`), `unit ${unit.id} under role ${role.id}`).toBe(
          true,
        );
        for (const element of unit.elements) {
          expect(
            element.id.startsWith(`${unit.id}.`),
            `element ${element.id} under unit ${unit.id}`,
          ).toBe(true);
        }
      }
    }
  });

  it('has unique ids across the whole tree', () => {
    const roleIds = syllabus.roles.map((role) => role.id);
    const unitIds = syllabus.roles.flatMap((role) => role.units.map((unit) => unit.id));
    const elementIds = syllabus.roles.flatMap((role) =>
      role.units.flatMap((unit) => unit.elements.map((element) => element.id)),
    );
    expect(new Set(roleIds).size).toBe(roleIds.length);
    expect(new Set(unitIds).size).toBe(unitIds.length);
    expect(new Set(elementIds).size).toBe(elementIds.length);
  });

  it('counts equals a recount of the tree', () => {
    const units = syllabus.roles.reduce((sum, role) => sum + role.units.length, 0);
    const elements = syllabus.roles.reduce(
      (sum, role) => sum + role.units.reduce((unitSum, unit) => unitSum + unit.elements.length, 0),
      0,
    );
    expect(syllabus.counts).toEqual({ roles: syllabus.roles.length, units, elements });
  });

  it('every element has at least one entry in mustBeAbleTo or mustKnow', () => {
    for (const role of syllabus.roles) {
      for (const unit of role.units) {
        for (const element of unit.elements) {
          const total = element.mustBeAbleTo.length + element.mustKnow.length;
          expect(total, `element ${element.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('meets the structural floors from scout.md (counted, not assumed)', () => {
    expect(syllabus.counts.units).toBeGreaterThanOrEqual(10);
    expect(syllabus.counts.elements).toBeGreaterThanOrEqual(25);
  });

  it('licence.statement equals the OGL sentence', () => {
    expect(syllabus.licence.statement).toBe(
      'Contains public sector information licensed under the Open Government Licence v3.0.',
    );
  });
});
