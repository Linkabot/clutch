// Signs content loader: the shape/colour rule table, memory hooks and
// (once Step 15 ingests it) the sign catalogue itself -- the only module
// inside the app that reads content/uk/signs/. getShapeRules() and
// getHooks() are small, already-committed JSON files loaded eagerly and
// validated once; loadSigns() is a lazy import.meta.glob for
// content/uk/signs/signs.json, which does not exist until Step 15, so it
// rejects with SignsNotFound until then (the same eager/lazy split and
// PromiseCache retry-on-rejection as src/content/loaders.ts, plan.md C-S1).
// signImageUrl() builds the <img src> for a sign's picture -- pictures are
// never statically imported or inlined (plan.md D7). hookFor() implements
// § Memory hooks' display rule: a sign's own hook first, then (sheet
// context only) its rule's hook, then its family's hook.
// Depends on: ./schemas (Zod schemas), ./memo (PromiseCache), Vite's
// import.meta.glob.
// Depended on by: Step 15 ingestion output, sign screens and games (Step 17
// onward).

import {
  ShapeRulesFileSchema,
  HooksFileSchema,
  SignsFileSchema,
  type ShapeRulesFile,
  type Hook,
  type Sign,
} from './schemas';
import { createPromiseCache } from './memo';

const shapeRulesModule = import.meta.glob<{ default: unknown }>(
  '../../content/uk/signs/shape-rules.json',
  { eager: true },
);

const hooksModule = import.meta.glob<{ default: unknown }>('../../content/uk/signs/hooks.json', {
  eager: true,
});

// Lazy (no `eager` option): the file does not exist until Step 15 ingests
// it, so this glob matches nothing until then -- loadSignsUncached() below
// treats an empty match as "not ingested yet", not an error.
const signsLoaders = import.meta.glob<{ default: unknown }>('../../content/uk/signs/signs.json');

function onlyModuleValue(modules: Record<string, { default: unknown }>): unknown {
  const values = Object.values(modules);
  if (values.length !== 1) {
    throw new Error(`expected exactly one matching module, found ${values.length}`);
  }
  return values[0].default;
}

let cachedShapeRules: ShapeRulesFile | undefined;

/** The shape/colour rule table (content/uk/signs/shape-rules.json), parsed once and memoised. */
export function getShapeRules(): ShapeRulesFile {
  if (!cachedShapeRules) {
    cachedShapeRules = ShapeRulesFileSchema.parse(onlyModuleValue(shapeRulesModule));
  }
  return cachedShapeRules;
}

let cachedHooks: Hook[] | undefined;

/** Every memory hook from content/uk/signs/hooks.json, parsed once and memoised. */
export function getHooks(): Hook[] {
  if (!cachedHooks) {
    cachedHooks = HooksFileSchema.parse(onlyModuleValue(hooksModule)).hooks;
  }
  return cachedHooks;
}

/** Rejected by loadSigns() while content/uk/signs/signs.json does not exist yet (ingested in Step 15). */
export class SignsNotFound extends Error {
  constructor() {
    super('content/uk/signs/signs.json not found (ingested in Step 15)');
    this.name = 'SignsNotFound';
  }
}

async function loadSignsUncached(): Promise<Sign[]> {
  const modules = Object.values(signsLoaders);
  if (modules.length !== 1) {
    throw new SignsNotFound();
  }
  const loaded = await modules[0]();
  return SignsFileSchema.parse(loaded.default).signs;
}

const signsCache = createPromiseCache<'signs', Sign[]>();

/**
 * Loads and validates every sign from content/uk/signs/signs.json, memoised
 * in module scope. Rejects with SignsNotFound while the file does not exist;
 * a rejected load is evicted from the cache, so a retry after ingestion
 * lands calls the loader again instead of replaying the rejection forever.
 */
export function loadSigns(): Promise<Sign[]> {
  return signsCache.get('signs', loadSignsUncached);
}

/** The <img src> for a sign's picture, built from the base path -- never a static import (plan.md D7). */
export function signImageUrl(sign: Sign): string {
  return import.meta.env.BASE_URL + sign.image;
}

function findHookById(id: string | null): Hook | null {
  if (id === null) return null;
  return getHooks().find((hook) => hook.id === id) ?? null;
}

/**
 * The memory hook to show for `sign` in `context`, per § Memory hooks'
 * display rule. Returns the whole Hook object (id, text, appliesTo, cites)
 * rather than just its text, so a caller can also render its citation.
 *
 *  - 'page' (the sign page's "Memory hook" row): the sign's own hook (by
 *    sign.hookId) only, else null -- most signs show none (D10).
 *  - 'sheet' (the quiz sheet's bold line, and the Decoder's hook-under-body):
 *    the sign's own hook, else the hook whose appliesTo.rules includes the
 *    sign's rule, else the hook whose appliesTo.family is the sign's
 *    family, else null.
 */
export function hookFor(sign: Sign, context: 'page' | 'sheet'): Hook | null {
  const own = findHookById(sign.hookId);
  if (own) return own;
  if (context === 'page') return null;

  const byRule = getHooks().find(
    (hook) => 'rules' in hook.appliesTo && hook.appliesTo.rules.includes(sign.rule),
  );
  if (byRule) return byRule;

  const byFamily = getHooks().find(
    (hook) => 'family' in hook.appliesTo && hook.appliesTo.family === sign.family,
  );
  return byFamily ?? null;
}
