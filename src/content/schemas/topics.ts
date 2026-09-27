// Zod schemas for content/uk/topics.json (Phase 3 block 3a Step 6): the
// 12-16 plain-English Clutch topics built on Schedule 7 (A-G) of the Motor
// Vehicles (Driving Licences) Regulations 1999, the Highway Code's sections
// and the National Standard's elements, each with a DVSA area
// cross-reference; plus the file's OGL licence block citing the Highway
// Code, the National Standard and SI 1999/2864 Schedule 7. The 14 DVSA area
// names themselves are not exported from here: they live only in
// tests/content/dvsa-areas.ts's DVSA_AREAS export (Phase 3 block 3a Step 9).
// Depends on: zod.
// Depended on by: src/content/schemas/index.ts, tests/content/topics.test.ts.
import { z } from 'zod';

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const Schedule7LetterSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

export const TopicSchema = z.object({
  id: z.string().regex(KEBAB),
  name: z.string().min(1),
  order: z.number().int().positive(),
  areas: z.array(z.string()).min(1),
  schedule7: z.array(Schedule7LetterSchema).min(1),
  hcSections: z.array(z.string()),
  nsElements: z.array(z.string()),
});

export const TopicsLicenceSourceSchema = z.object({
  name: z.string().min(1),
  url: z.url(),
});

export const TopicsLicenceSchema = z.object({
  statement: z.string().min(1),
  sources: z.array(TopicsLicenceSourceSchema),
});

export const TopicsFileSchema = z.object({
  licence: TopicsLicenceSchema,
  topics: z.array(TopicSchema),
});

export type Schedule7Letter = z.infer<typeof Schedule7LetterSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type TopicsLicenceSource = z.infer<typeof TopicsLicenceSourceSchema>;
export type TopicsLicence = z.infer<typeof TopicsLicenceSchema>;
export type TopicsFile = z.infer<typeof TopicsFileSchema>;
