// Signs content loader: the shape/colour rule table, memory hooks and the
// sign catalogue itself -- the only module inside the app that reads
// content/uk/signs/. getShapeRules() and getHooks() are small,
// already-committed JSON files loaded eagerly and validated once;
// loadSigns() is a lazy import.meta.glob for content/uk/signs/signs.json
// (the same eager/lazy split and PromiseCache retry-on-rejection as
// src/content/loaders.ts, plan.md C-S1); it rejects with SignsNotFound if
// no module matches the glob. signImageUrl() builds the <img src> for a
// sign's picture -- pictures are never statically imported or inlined
// (plan.md D7). displayName() trims signs.json's one trailing full stop
// for display; gameName() (Q7) additionally substitutes the Highway Code
// short names in GAME_NAMES for the two LOOK_ALIKE_PAIR signs (STOP and
// GIVE WAY), whose KYTS names are long instructions, not names -- the sign
// page always shows displayName, never gameName. hookFor() implements
// § Memory hooks' display rule (Q6, PS9): a sign's own hook first; then,
// for a C9 direction sign (no glyph of its own), null; otherwise the hook
// whose rules include the sign's rule, else its family's hook -- both
// 'page' and 'sheet' contexts now resolve alike.
// Depends on: ./schemas (Zod schemas), ./memo (PromiseCache), Vite's
// import.meta.glob.
// Depended on by: src/features/learn/LearnScreen.tsx,
// src/features/practice/PracticeScreen.tsx,
// src/features/practice/tap/TapTheSignScreen.tsx,
// src/features/practice/tap/round.ts, src/features/signs/SignScreen.tsx,
// src/features/signs/SignsScreen.tsx,
// src/features/interactives/shared/SignImage.tsx,
// src/features/interactives/sign-sprint/SignSprint.tsx,
// src/features/interactives/match-pairs/MatchPairs.tsx,
// src/features/interactives/shape-colour-decoder/Decoder.tsx,
// tests/unit/decoder.test.tsx, tests/unit/match-pairs.test.tsx,
// tests/unit/sign-hooks.test.ts, tests/unit/sign-names.test.ts,
// tests/unit/sign-sprint.test.tsx, tests/unit/tap-round.test.ts.

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

/** signs.json's raw name with exactly one trailing full stop trimmed for display (Q2). */
export function displayName(sign: { name: string }): string {
  return sign.name.replace(/\.$/, '');
}

/**
 * The two signs learners must tell apart by shape, not caption (Q7): STOP
 * and GIVE WAY.
 */
export const LOOK_ALIKE_PAIR = [
  'orders-stop-sign-and-road-marking',
  'orders-give-way-road-marking',
] as const;

/**
 * The Highway Code's short names for the two LOOK_ALIKE_PAIR signs, whose
 * KYTS names ("The 'STOP' sign and road markings", "The 'GIVE WAY' sign and
 * road markings") are long instructions, not names a learner would say.
 * Sourced from the Highway Code's traffic-signs section
 * (content/uk/highway-code/sections/traffic-signs.json), whose bodyHtml
 * diagram links read "↗ Stop and give way (diagram, online)" and
 * "↗ Give way to traffic on major road (diagram, online)".
 */
export const GAME_NAMES: Readonly<Record<string, string>> = {
  'orders-stop-sign-and-road-marking': 'Stop and give way',
  'orders-give-way-road-marking': 'Give way to traffic on major road',
};

/** The name to show in a game (Q7): the two GAME_NAMES short names, else displayName(sign). */
export function gameName(sign: { id: string; name: string }): string {
  return GAME_NAMES[sign.id] ?? displayName(sign);
}

function findHookById(id: string | null): Hook | null {
  if (id === null) return null;
  return getHooks().find((hook) => hook.id === id) ?? null;
}

/**
 * The memory hook to show for `sign`, per § Memory hooks' display rule
 * (Q6, PS9): the sign's own hook first; then, for a C9 direction sign (a
 * traffic sign with no glyph of its own, e.g. tourist information signs),
 * null; otherwise the hook whose appliesTo.rules includes the sign's rule,
 * else the hook whose appliesTo.family is the sign's family, else null.
 * Both `context` values ('page', the sign page's "Memory tip" row, and
 * 'sheet', the quiz sheet's bold line and the Decoder's hook-under-body)
 * now resolve alike; `context` stays in the signature for its callers.
 * Returns the whole Hook object (id, text, appliesTo, cites) rather than
 * just its text, so a caller can also render its citation.
 */
export function hookFor(sign: Sign, context: 'page' | 'sheet'): Hook | null {
  void context; // kept for callers; both contexts resolve alike (Q6)
  const own = findHookById(sign.hookId);
  if (own) return own;
  if (sign.family === 'direction' && sign.rule === 'C9') return null;

  const byRule = getHooks().find(
    (hook) => 'rules' in hook.appliesTo && hook.appliesTo.rules.includes(sign.rule),
  );
  if (byRule) return byRule;

  const byFamily = getHooks().find(
    (hook) => 'family' in hook.appliesTo && hook.appliesTo.family === sign.family,
  );
  return byFamily ?? null;
}
