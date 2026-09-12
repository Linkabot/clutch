# Content Guide

Skeleton only — Phase 1 adds the actual schemas, scripts and content.

## Principles

Content is data, not code: JSON + Markdown under `content/uk/`, validated
against Zod schemas in `src/content/schemas/`. `npm run validate:content`
must exit 0 and runs inside `npm test`. Phase 1 adds the schemas and the
script; Phase 0 only reserves the names.

## Pack

`pack.json` = `{ region: "GB", version, attribution[] }`.

## Facts

`facts.json` is the ONLY permitted source of numbers in questions. Each
fact cites its Highway Code rule or gov.uk source.

## Questions

Field list: `id`, `category` (one of the 14 DVSA topics), `stem`,
`options[]` with exactly one correct, `explanation`, `refs[]` that must
resolve, `tags[]`, `difficulty`, optional `syllabus[]`, optional `image`.

## Signs

Field list: `id`, `name`, `family`, `shape`, `colours`, `meaning`, `hook`,
`image` (file must exist), `refs[]`, `licence`, `source`.

## Attribution

`public/ATTRIBUTION.md` is shipped and shown on Me. Highway Code text carries "Contains public sector information licensed under the Open Government Licence v3.0."

## Never

No pasting from commercial sources. No video fetching. Links out only as
clearly online-only extras.

## Regional differences

State regional differences explicitly rather than averaging them — for
example the Scotland drink-drive limit and the Wales 20 mph default.
