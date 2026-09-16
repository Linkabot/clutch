// Content loaders: the only module inside the app that reads content/uk/.
// Wraps import.meta.glob so every consumer gets already-parsed,
// schema-validated HighwayCodeIndex / Section / Fact objects, never raw
// JSON — no static `import x from '*.json'` appears anywhere else in src/.
// The Highway Code index and facts.json are small and loaded eagerly
// (bundled into the main chunk); each Highway Code section is its own lazy
// Vite chunk, fetched only when its content is first needed, so the
// initial bundle does not carry the whole Highway Code. The per-section
// cache is a PromiseCache (./memo.ts) so a failed load can be retried
// instead of replaying the same rejection forever (plan.md C-S1).
// Depends on: ./schemas (Zod schemas), ./memo (PromiseCache), Vite's
// import.meta.glob.
// Depended on by: src/features/code/search.ts, Highway Code screens
// (Step 15 onward).

import {
  HighwayCodeIndexSchema,
  SectionSchema,
  FactsFileSchema,
  type HighwayCodeIndex,
  type Section,
  type Rule,
  type Fact,
} from './schemas';
import { createPromiseCache } from './memo';

/** Rejected by loadSection() / loadRule() for a slug the index does not list. */
export class SectionNotFound extends Error {
  constructor(slug: string) {
    super(`Highway Code section not found: ${slug}`);
    this.name = 'SectionNotFound';
  }
}

// This names the exact file, not a broader pattern, because
// content/uk/highway-code/sections/index.json is also a real section
// (titled "Index", slug "index"); a pattern matching every such file under
// content/uk/ would find both with no way to tell them apart. eager: true
// because this one file is small and needed on first render.
const highwayCodeIndexModule = import.meta.glob<{ default: unknown }>(
  '../../content/uk/highway-code/index.json',
  { eager: true },
);

const factsModule = import.meta.glob<{ default: unknown }>('../../content/uk/facts.json', {
  eager: true,
});

// Lazy (no `eager` option): Vite emits one JS chunk per section file,
// code-split out of the main bundle and precached by Workbox's existing
// `**/*.js` glob, fetched only when loadSection/loadRule first needs it.
const sectionLoaders = import.meta.glob<{ default: unknown }>(
  '../../content/uk/highway-code/sections/*.json',
);

function onlyModuleValue(modules: Record<string, { default: unknown }>): unknown {
  const values = Object.values(modules);
  if (values.length !== 1) {
    throw new Error(`expected exactly one matching module, found ${values.length}`);
  }
  return values[0].default;
}

let cachedIndex: HighwayCodeIndex | undefined;

/** The Highway Code index (section list, licence, source), parsed once and memoised. */
export function getHighwayCodeIndex(): HighwayCodeIndex {
  if (!cachedIndex) {
    cachedIndex = HighwayCodeIndexSchema.parse(onlyModuleValue(highwayCodeIndexModule));
  }
  return cachedIndex;
}

let cachedFacts: Fact[] | undefined;

/** Every fact from facts.json, parsed once and memoised. */
export function getFacts(): Fact[] {
  if (!cachedFacts) {
    cachedFacts = FactsFileSchema.parse(onlyModuleValue(factsModule)).facts;
  }
  return cachedFacts;
}

function findSectionLoader(slug: string): () => Promise<{ default: unknown }> {
  const entry = Object.entries(sectionLoaders).find(([path]) => path.endsWith(`/${slug}.json`));
  if (!entry) throw new SectionNotFound(slug);
  return entry[1];
}

async function loadSectionUncached(slug: string): Promise<Section> {
  const loader = findSectionLoader(slug);
  const loaded = await loader();
  return SectionSchema.parse(loaded.default);
}

const sectionCache = createPromiseCache<string, Section>();

/**
 * Loads and validates one Highway Code section by slug, memoised in module
 * scope. Rejects with SectionNotFound for a slug the index does not list.
 * A rejected load is evicted from the cache, so a retry after a failure
 * (e.g. a transient chunk-fetch error) calls the loader again.
 */
export function loadSection(slug: string): Promise<Section> {
  return sectionCache.get(slug, () => loadSectionUncached(slug));
}

/** Loads every Highway Code section, in the index's published order. */
export function loadAllSections(): Promise<Section[]> {
  return Promise.all(getHighwayCodeIndex().sections.map((section) => loadSection(section.slug)));
}

/** Finds the rule with this id and the section that owns it, or null if the index does not list it. */
export async function loadRule(id: string): Promise<{ rule: Rule; section: Section } | null> {
  const owner = getHighwayCodeIndex().sections.find((section) => section.ruleIds.includes(id));
  if (!owner) return null;
  const section = await loadSection(owner.slug);
  const rule = section.rules.find((candidate) => candidate.id === id);
  return rule ? { rule, section } : null;
}
