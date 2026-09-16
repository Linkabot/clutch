// Zod schemas for the ingested Highway Code: a single rule, an interlude
// (a kept run of content between or after rules, Step 5 S3), a section
// (a page of the Code holding zero or more rules), and the top-level
// index that lists every section in published order.
// Depends on: zod.
// Depended on by: src/content/schemas/index.ts, scripts/lib/highway-code-parse.ts
// (Step 8), tests/content/highway-code.test.ts (Step 9).
import { z } from 'zod';

const RULE_ID = /^(\d{1,3}|H[1-3])$/;
const SLUG = /^[a-z0-9-]+$/;

export const SectionKind = z.enum(['introduction', 'rules', 'signals', 'annex', 'other']);

export const RuleImageSchema = z.object({
  src: z.url(),
  alt: z.string(),
});

// A run of top-level siblings that `splitIntoBuckets` (Step 5, S3) keeps
// instead of dropping: content that sits after a mid-section heading and
// before the next rule heading, or after the last rule with no further
// rule heading to follow it. `beforeRuleId` is that following rule's id,
// or null when the run continues to the end of the section's body.
export const InterludeSchema = z.object({
  beforeRuleId: z.string().regex(RULE_ID).nullable(),
  html: z.string(),
});

export const RuleSchema = z
  .object({
    id: z.string().regex(RULE_ID),
    number: z.number().int().nullable(),
    title: z.string(),
    lead: z.string().nullable(),
    html: z.string().min(1),
    law: z.boolean(),
    mustCount: z.number().int().min(0),
    mustNotCount: z.number().int().min(0),
    crossRefs: z.array(z.string().regex(RULE_ID)),
    images: z.array(RuleImageSchema),
  })
  .refine((rule) => rule.law === rule.mustCount + rule.mustNotCount > 0, {
    message: 'law must equal (mustCount + mustNotCount > 0)',
    path: ['law'],
  });

export const SectionSchema = z.object({
  slug: z.string().regex(SLUG),
  title: z.string(),
  basePath: z.string().startsWith('/guidance/the-highway-code'),
  sourceUrl: z.url(),
  order: z.number().int().min(0),
  kind: SectionKind,
  preambleHtml: z.string(),
  bodyHtml: z.string(),
  rules: z.array(RuleSchema),
  // `.default([])` so every section committed before Step 5 (S3) — none of
  // which has this key at all — still parses.
  interludes: z.array(InterludeSchema).default([]),
});

export const HighwayCodeIndexSchema = z.object({
  source: z.object({
    title: z.string(),
    url: z.url(),
    apiUrl: z.url(),
    publicUpdatedAt: z.string(),
    fetchedAt: z.string(),
  }),
  licence: z.object({
    name: z.literal('Open Government Licence v3.0'),
    url: z.url(),
    statement: z.literal(
      'Contains public sector information licensed under the Open Government Licence v3.0.',
    ),
    footer: z.string(),
  }),
  sections: z.array(
    z.object({
      slug: z.string().regex(SLUG),
      title: z.string(),
      order: z.number().int().min(0),
      kind: SectionKind,
      ruleIds: z.array(z.string()),
    }),
  ),
});

export type RuleImage = z.infer<typeof RuleImageSchema>;
export type Interlude = z.infer<typeof InterludeSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type HighwayCodeIndex = z.infer<typeof HighwayCodeIndexSchema>;
