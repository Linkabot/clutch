// Zod schemas for content/uk/govuk/*.json: the 15 GOV.UK guidance and
// transaction pages ingested by scripts/ingest-govuk-pages.ts (Step 5). One
// page file per base path (GovukPageSchema, its `parts` built by
// scripts/lib/govuk-pages.ts's parsePage), plus the folder's own
// GovukIndexSchema (content/uk/govuk/index.json): the shared OGL licence
// block and a `{ slug, title, url }` entry per page, in ingest order.
// Depends on: zod.
// Depended on by: src/content/schemas/index.ts, scripts/lib/govuk-pages.ts,
// scripts/ingest-govuk-pages.ts, scripts/verify-govuk-pages.ts,
// tests/content/govuk.test.ts.
import { z } from 'zod';

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const GovukPartSchema = z.object({
  slug: z.string().regex(KEBAB),
  title: z.string().min(1),
  html: z.string().min(1),
});

export const GovukPageSchema = z.object({
  slug: z.string().regex(KEBAB),
  title: z.string().min(1),
  url: z.url(),
  basePath: z.string(),
  publicUpdatedAt: z.string().nullable(),
  fetchedAt: z.string(),
  licenceLine: z.string().min(1),
  parts: z.array(GovukPartSchema).nonempty(),
});

export const GovukIndexEntrySchema = z.object({
  slug: z.string().regex(KEBAB),
  title: z.string().min(1),
  url: z.url(),
});

export const GovukIndexSchema = z.object({
  licence: z.object({
    name: z.literal('Open Government Licence v3.0'),
    url: z.url(),
    statement: z.string(),
  }),
  pages: z.array(GovukIndexEntrySchema),
});

export type GovukPart = z.infer<typeof GovukPartSchema>;
export type GovukPage = z.infer<typeof GovukPageSchema>;
export type GovukIndexEntry = z.infer<typeof GovukIndexEntrySchema>;
export type GovukIndex = z.infer<typeof GovukIndexSchema>;
