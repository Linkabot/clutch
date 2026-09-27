// Content test: content/uk/topics.json (Phase 3 block 3a Step 6) parses
// against TopicsFileSchema and proves the 14-area coverage test: 12-16
// topics with unique ids and names and order running 1 to n in file order;
// every topic's areas entry is one of the 14 official DVSA test areas
// (DVSA_AREAS, copied from scout-d.md § 6 and held only here per plan.md
// Step 6); all 14 areas are reached by at least one topic; no topic's own
// name equals a DVSA area name; every hcSections slug and nsElements id
// resolves against the committed Highway Code index and National Standard
// syllabus; every one of the 31 National Standard elements is mapped; every
// Schedule 7 letter A-G is used; exactly one topic covers "Vulnerable road
// users"; and the licence block names the three sources by pack.json's
// attribution names.
// Depends on: vitest, src/content/schemas, tests/content/helpers.ts.
// Depended on by: `npm run validate:content` / `npm test`.
import { describe, it, expect } from 'vitest';
import { TopicsFileSchema } from '../../src/content/schemas';
import type { TopicsFile } from '../../src/content/schemas';
import { readJson } from './helpers';

// scout-d.md § 6 (Highway Code / National Standard / Schedule 7 topic-list
// frames), corroborated by scout-a.md § 6: the 14 official DVSA test areas.
// This list lives ONLY here, never in src/, scripts/ or another test file
// (plan.md Step 6).
const DVSA_AREAS = [
  'Alertness',
  'Attitude',
  'Safety and your vehicle',
  'Safety margins',
  'Hazard awareness',
  'Vulnerable road users',
  'Other types of vehicle',
  'Vehicle handling',
  'Motorway rules',
  'Rules of the road',
  'Road and traffic signs',
  'Essential documents',
  'Incidents, accidents and emergencies',
  'Vehicle loading',
];

interface HighwayCodeIndex {
  sections: { slug: string }[];
}

interface Syllabus {
  roles: { units: { elements: { id: string }[] }[] }[];
}

describe('content/uk/topics.json', () => {
  const file = readJson<TopicsFile>('topics.json');
  const hcIndex = readJson<HighwayCodeIndex>('highway-code/index.json');
  const syllabus = readJson<Syllabus>('syllabus.json');
  const hcSlugs = new Set(hcIndex.sections.map((s) => s.slug));
  const elementIds = new Set(
    syllabus.roles.flatMap((r) => r.units.flatMap((u) => u.elements.map((e) => e.id))),
  );

  it('NEW S6: topics.json parses against TopicsFileSchema', () => {
    expect(() => TopicsFileSchema.parse(file)).not.toThrow();
  });

  it('NEW S6: there are 12 to 16 topics with unique ids and names and order running 1 to n', () => {
    const { topics } = TopicsFileSchema.parse(file);
    expect(topics.length).toBeGreaterThanOrEqual(12);
    expect(topics.length).toBeLessThanOrEqual(16);
    expect(new Set(topics.map((t) => t.id)).size).toBe(topics.length);
    expect(new Set(topics.map((t) => t.name.toLowerCase())).size).toBe(topics.length);
    expect(topics.map((t) => t.order)).toEqual(topics.map((_, i) => i + 1));
  });

  it('NEW S6: every areas entry is one of the 14 DVSA areas, spelled exactly', () => {
    const { topics } = TopicsFileSchema.parse(file);
    const areaSet = new Set(DVSA_AREAS);
    for (const topic of topics) {
      for (const area of topic.areas) {
        expect(areaSet.has(area), `topic ${topic.id}: area ${JSON.stringify(area)}`).toBe(true);
      }
    }
  });

  it('NEW S6: every one of the 14 DVSA areas is reached by at least one topic', () => {
    const { topics } = TopicsFileSchema.parse(file);
    const reached = new Set(topics.flatMap((t) => t.areas));
    for (const area of DVSA_AREAS) {
      expect(reached.has(area), `no topic reaches ${area}`).toBe(true);
    }
  });

  it('NEW S6: no topic name equals a DVSA area name, ignoring case', () => {
    const { topics } = TopicsFileSchema.parse(file);
    const areaLower = new Set(DVSA_AREAS.map((a) => a.toLowerCase()));
    for (const topic of topics) {
      expect(areaLower.has(topic.name.trim().toLowerCase()), topic.id).toBe(false);
    }
  });

  it('NEW S6: every hcSections slug is a Highway Code section and every nsElements id a National Standard element', () => {
    const { topics } = TopicsFileSchema.parse(file);
    for (const topic of topics) {
      for (const slug of topic.hcSections) {
        expect(hcSlugs.has(slug), `topic ${topic.id}: hcSections ${slug}`).toBe(true);
      }
      for (const id of topic.nsElements) {
        expect(elementIds.has(id), `topic ${topic.id}: nsElements ${id}`).toBe(true);
      }
    }
  });

  it('NEW S6: every one of the 31 National Standard elements is mapped by at least one topic', () => {
    const { topics } = TopicsFileSchema.parse(file);
    const mapped = new Set(topics.flatMap((t) => t.nsElements));
    for (const id of elementIds) {
      expect(mapped.has(id), `no topic maps element ${id}`).toBe(true);
    }
  });

  it('NEW S6: every Schedule 7 letter A to G is used by at least one topic', () => {
    const { topics } = TopicsFileSchema.parse(file);
    const letters = new Set<string>(topics.flatMap((t) => t.schedule7));
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
      expect(letters.has(letter), `no topic uses Schedule 7 letter ${letter}`).toBe(true);
    }
  });

  it('NEW S6: exactly one topic covers Vulnerable road users', () => {
    const { topics } = TopicsFileSchema.parse(file);
    const vru = topics.filter((t) => t.areas.includes('Vulnerable road users'));
    expect(vru).toHaveLength(1);
  });

  it('NEW S6: licence.sources names the three sources with their URLs', () => {
    const { licence } = TopicsFileSchema.parse(file);
    expect(licence.sources).toHaveLength(3);
    const byUrl = new Map(licence.sources.map((s) => [s.url, s.name]));
    expect(byUrl.get('https://www.gov.uk/guidance/the-highway-code')).toBe('The Highway Code');
    expect(
      byUrl.get(
        'https://www.gov.uk/guidance/national-standard-for-driving-cars-and-light-vans-category-b',
      ),
    ).toBe('National standard for driving cars and light vans (category B)');
    expect(byUrl.get('https://www.legislation.gov.uk/uksi/1999/2864/schedule/7/made')).toBeTruthy();
  });
});
