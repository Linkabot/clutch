// Zod schema for content/uk/pack.json, the top-level content pack
// manifest: region, semver version, and the attribution list the Me tab
// cross-checks against public/ATTRIBUTION.md.
// Depends on: zod.
// Depended on by: src/content/schemas/index.ts, tests/content/pack.test.ts.
import { z } from 'zod';

export const AttributionEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  licence: z.string(),
  url: z.url(),
  statement: z.string().optional(),
});

export const PackSchema = z
  .object({
    region: z.literal('GB'),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    attribution: z.array(AttributionEntrySchema).nonempty(),
  })
  .refine(
    (pack) => new Set(pack.attribution.map((entry) => entry.id)).size === pack.attribution.length,
    { message: 'attribution ids must be unique', path: ['attribution'] },
  );

export type AttributionEntry = z.infer<typeof AttributionEntrySchema>;
export type Pack = z.infer<typeof PackSchema>;
