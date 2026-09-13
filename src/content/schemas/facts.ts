// Zod schemas for facts.json, the only permitted source of numbers used
// elsewhere in the app: a fact's value, its gov.uk source, and how it was
// verified (a quote proven against the ingested rule text, or a number
// still pending or already confirmed by a human against an official
// chart).
// Depends on: zod.
// Depended on by: src/content/schemas/index.ts, tests/content/facts.test.ts
// (Step 11), Step 12's stopping-distance facts.
import { z } from 'zod';

const FACT_ID = /^[a-z0-9-]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const FactSourceSchema = z.object({
  rule: z.string().nullable(),
  section: z.string().nullable(),
  url: z.url(),
  title: z.string(),
});

export const FactVerificationSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('quote-in-rule') }),
  z.object({ method: z.literal('pending-human'), against: z.url() }),
  z.object({
    method: z.literal('human-vs-official-chart'),
    by: z.string(),
    on: z.string().regex(DATE),
    against: z.url(),
  }),
]);

export const FactSchema = z
  .object({
    id: z.string().regex(FACT_ID),
    topic: z.string(),
    statement: z.string(),
    value: z.union([z.number(), z.string()]),
    unit: z.string().nullable(),
    source: FactSourceSchema,
    quote: z.string().nullable(),
    data: z.record(z.string(), z.union([z.number(), z.string()])).nullable(),
    verification: FactVerificationSchema,
  })
  .refine(
    (fact) => {
      if (fact.verification.method !== 'quote-in-rule') return true;
      const hasQuote = typeof fact.quote === 'string' && fact.quote.length > 0;
      const hasSource = fact.source.rule !== null || fact.source.section !== null;
      return hasQuote && hasSource;
    },
    {
      message: 'quote-in-rule facts need a non-empty quote and a source.rule or source.section',
      path: ['quote'],
    },
  )
  .refine((fact) => (fact.verification.method === 'quote-in-rule' ? true : fact.data !== null), {
    message: 'pending-human and human-vs-official-chart facts need data',
    path: ['data'],
  });

export const FactsFileSchema = z
  .object({ facts: z.array(FactSchema) })
  .refine((file) => new Set(file.facts.map((fact) => fact.id)).size === file.facts.length, {
    message: 'fact ids must be unique',
    path: ['facts'],
  });

export type FactSource = z.infer<typeof FactSourceSchema>;
export type FactVerification = z.infer<typeof FactVerificationSchema>;
export type Fact = z.infer<typeof FactSchema>;
export type FactsFile = z.infer<typeof FactsFileSchema>;
