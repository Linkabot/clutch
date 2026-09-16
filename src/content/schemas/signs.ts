// Zod schemas for the road-signs content: a single sign (once Step 15
// ingests content/uk/signs/signs.json), the shape/colour rule table
// (content/uk/signs/shape-rules.json), the memory hooks
// (content/uk/signs/hooks.json), the KYTS selection rules
// (content/uk/signs/selection.json), and the attribution manifest Step 15
// writes alongside the pictures under public/signs/.
// Depends on: zod.
// Depended on by: src/content/schemas/index.ts, src/content/signs.ts,
// tests/unit/sign-schema.test.ts, tests/unit/sign-hooks.test.ts,
// tests/content/signs-rules.test.ts, scripts/lib/kyts-select.ts (Step 14).
import { z } from 'zod';

const SIGN_ID = /^(warning|orders|motorway|direction|information|road-works)-[a-z0-9_-]+$/;
const SIGN_IMAGE =
  /^signs\/(warning|orders|motorway|direction|information|road-works)\/[A-Za-z0-9_.-]+\.svg$/;
const SHA256 = /^[0-9a-f]{64}$/;

export const SignFamilySchema = z.enum([
  'warning',
  'orders',
  'motorway',
  'direction',
  'information',
  'road-works',
]);

export const SignShapeSchema = z.enum(['triangle', 'circle', 'rectangle', 'other']);

export const SignColourSchema = z.enum(['red', 'blue', 'green', 'white']);

// C7 splits into three outcomes by route colour (§ Shape and colour rules);
// every other id names one shape-colour rule outright.
export const SignRuleSchema = z.enum([
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7-green',
  'C7-white',
  'C7-green-white',
  'C8',
  'C9',
]);

export const SignRefSchema = z.object({
  kind: z.literal('section'),
  slug: z.string(),
});

export const SignSchema = z.object({
  id: z.string().regex(SIGN_ID),
  name: z.string(),
  meaning: z.string(),
  family: SignFamilySchema,
  shape: SignShapeSchema,
  colours: z.array(SignColourSchema),
  rule: SignRuleSchema,
  // The sign's own memory hook only (§ Memory hooks); null for most signs
  // (D10). Rule- and family-level fallbacks are resolved at runtime by
  // src/content/signs.ts's hookFor(), not stored per sign.
  hookId: z.string().nullable(),
  image: z.string().regex(SIGN_IMAGE),
  refs: z.array(SignRefSchema).min(1),
  licence: z.literal('Open Government Licence v3.0'),
  source: z.object({
    chapterSlug: z.string(),
    chapterUrl: z.url(),
    imageUrl: z.url(),
    subHeading: z.string(),
  }),
});

export const SignsFileSchema = z.object({
  publication: z.object({
    title: z.string(),
    url: z.url(),
    publicUpdatedAt: z.string(),
  }),
  licence: z.object({
    name: z.string(),
    url: z.url(),
    copyright: z.string(),
    statement: z.string(),
  }),
  signingSystemText: z.string(),
  signs: z.array(SignSchema),
});

// content/uk/signs/attribution.json (Step 15): one entry per sign picture,
// proving where each file came from and that it has not been altered since.
export const AttributionManifestSchema = z.object({
  entries: z.array(
    z.object({
      file: z.string(),
      sourceUrl: z.url(),
      chapterUrl: z.url(),
      bytes: z.number().int().min(0),
      sha256: z.string().regex(SHA256),
      licence: z.string(),
      copyright: z.string(),
    }),
  ),
});

// --- Shape and colour rules (content/uk/signs/shape-rules.json) ----------

const ShapeRuleIdSchema = z.enum(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9']);

const ShapeRuleMatchSchema = z.object({
  family: SignFamilySchema.optional(),
  families: z.array(SignFamilySchema).optional(),
  files: z.array(z.object({ family: SignFamilySchema, file: z.string() })).optional(),
  captionStartsWith: z.array(z.string()).optional(),
  subHeadingContains: z.string().optional(),
  routeColourTest: z.object({ containsToken: z.string(), remainderToken: z.string() }).optional(),
});

const ShapeRuleOutcomeSchema = z.object({
  shape: SignShapeSchema,
  colours: z.array(SignColourSchema),
  sentences: z.array(z.string()),
});

// Every rule but C7 carries shape/colours/sentences directly; C7 carries
// `outcomes` (keyed by SignRuleSchema's C7-* values) instead, since its
// shape/colours/sentences depend on the route-colour test at match time.
const ShapeRuleSchema = z
  .object({
    id: ShapeRuleIdSchema,
    match: ShapeRuleMatchSchema,
    shape: SignShapeSchema.optional(),
    colours: z.array(SignColourSchema).optional(),
    sentences: z.array(z.string()).optional(),
    outcomes: z.record(z.string(), ShapeRuleOutcomeSchema).optional(),
  })
  .refine(
    (rule) =>
      rule.outcomes
        ? rule.shape === undefined && rule.colours === undefined && rule.sentences === undefined
        : rule.shape !== undefined && rule.colours !== undefined && rule.sentences !== undefined,
    {
      message: 'a shape rule has either shape/colours/sentences or outcomes, never both',
      path: ['outcomes'],
    },
  );

const DecoderPairSchema = z.object({
  // null for the catch-all "any other pair" row.
  shape: SignShapeSchema.nullable(),
  colour: SignColourSchema.nullable(),
  title: z.string().nullable(),
  body: z.string(),
  examples: z.array(z.string()),
});

export const ShapeRulesFileSchema = z.object({
  rules: z.array(ShapeRuleSchema),
  shapeSentences: z.object({
    circle: z.string(),
    triangle: z.string(),
    rectangle: z.string(),
  }),
  exceptionsSentence: z.string(),
  decoderPairs: z.array(DecoderPairSchema),
});

// --- Memory hooks (content/uk/signs/hooks.json) ---------------------------

const HookAppliesToSchema = z.union([
  z.strictObject({ rules: z.array(SignRuleSchema) }),
  z.strictObject({ family: SignFamilySchema }),
  z.strictObject({ signIds: z.array(z.string()) }),
]);

const HookCiteSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('signing-system'), sentence: z.string() }),
  z.object({ source: z.literal('caption'), file: z.string(), sentence: z.string() }),
]);

export const HookSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  text: z.string(),
  appliesTo: HookAppliesToSchema,
  cites: z.array(HookCiteSchema).min(1),
});

export const HooksFileSchema = z
  .object({ hooks: z.array(HookSchema) })
  .refine((file) => new Set(file.hooks.map((hook) => hook.id)).size === file.hooks.length, {
    message: 'hook ids must be unique',
    path: ['hooks'],
  });

// --- KYTS selection rules (content/uk/signs/selection.json) --------------

export const SignSelectionFileSchema = z.object({
  chapters: z.array(z.object({ slug: z.string(), family: SignFamilySchema })),
  families: z.array(SignFamilySchema),
  r2CaptionPrefixes: z.array(z.string()),
  r3PlateFiles: z.array(z.object({ family: SignFamilySchema, file: z.string() })),
  r5SubHeadingPrefixes: z.array(z.string()),
  r8NamedParagraphCaptions: z.array(
    z.object({
      chapter: z.string(),
      family: SignFamilySchema,
      file: z.string(),
      paragraphPrefix: z.string(),
    }),
  ),
  allowLists: z.object({
    motorway: z.array(z.string()),
    direction: z.array(z.string()),
    information: z.array(z.string()),
    'road-works': z.array(z.string()),
  }),
  expectedCounts: z.object({
    warning: z.number().int(),
    orders: z.number().int(),
    motorway: z.number().int(),
    direction: z.number().int(),
    information: z.number().int(),
    'road-works': z.number().int(),
  }),
  expectedTotal: z.number().int(),
});

export type SignFamily = z.infer<typeof SignFamilySchema>;
export type SignShape = z.infer<typeof SignShapeSchema>;
export type SignColour = z.infer<typeof SignColourSchema>;
export type SignRule = z.infer<typeof SignRuleSchema>;
export type SignRef = z.infer<typeof SignRefSchema>;
export type Sign = z.infer<typeof SignSchema>;
export type SignsFile = z.infer<typeof SignsFileSchema>;
export type AttributionManifest = z.infer<typeof AttributionManifestSchema>;
export type ShapeRulesFile = z.infer<typeof ShapeRulesFileSchema>;
export type Hook = z.infer<typeof HookSchema>;
export type HooksFile = z.infer<typeof HooksFileSchema>;
export type SignSelectionFile = z.infer<typeof SignSelectionFileSchema>;
