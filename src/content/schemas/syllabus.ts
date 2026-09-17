// Zod schemas for content/uk/syllabus.json, generated from the National
// Standard for Driving Cars and Light Vans: roles, each holding units,
// each holding elements with their "must be able to" / "must know and
// understand" lists, plus a recount of the tree in `counts`.
// Depends on: zod.
// Depended on by: src/content/schemas/index.ts, scripts/ingest-national-standard.ts,
// scripts/lib/national-standard-parse.ts, tests/content/syllabus.test.ts,
// tests/unit/national-standard-parse.test.ts.
import { z } from 'zod';

const ROLE_ID = /^\d$/;
const UNIT_ID = /^\d\.\d$/;
const ELEMENT_ID = /^\d\.\d\.\d+$/;

export const SyllabusLicenceSchema = z.object({
  name: z.literal('Open Government Licence v3.0'),
  url: z.url(),
  statement: z.literal(
    'Contains public sector information licensed under the Open Government Licence v3.0.',
  ),
  footer: z.string(),
});

export const SyllabusElementSchema = z.object({
  id: z.string().regex(ELEMENT_ID),
  title: z.string(),
  mustBeAbleTo: z.array(z.string()),
  mustKnow: z.array(z.string()),
});

export const SyllabusUnitSchema = z.object({
  id: z.string().regex(UNIT_ID),
  title: z.string(),
  elements: z.array(SyllabusElementSchema),
});

export const SyllabusRoleSchema = z.object({
  id: z.string().regex(ROLE_ID),
  title: z.string(),
  units: z.array(SyllabusUnitSchema),
});

export const SyllabusSchema = z.object({
  source: z.object({
    title: z.string(),
    url: z.url(),
    apiUrl: z.url(),
    fetchedAt: z.string(),
    lastUpdated: z.string().nullable(),
  }),
  licence: SyllabusLicenceSchema,
  roles: z.array(SyllabusRoleSchema),
  counts: z.object({
    roles: z.number().int(),
    units: z.number().int(),
    elements: z.number().int(),
  }),
});

export type SyllabusElement = z.infer<typeof SyllabusElementSchema>;
export type SyllabusUnit = z.infer<typeof SyllabusUnitSchema>;
export type SyllabusRole = z.infer<typeof SyllabusRoleSchema>;
export type Syllabus = z.infer<typeof SyllabusSchema>;
