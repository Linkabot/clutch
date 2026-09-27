// The 14 official DVSA theory test areas (scout-d.md § 6, corroborated by
// scout-a.md § 6), copied here so both topics.test.ts and coverage.test.ts
// share one list rather than each keeping its own copy (Phase 3 block 3a
// Step 9; plan.md Step 6 held this list in topics.test.ts; amend-09 A49
// moves it here). Not `as const`: callers build a `Set<string>` from it and
// look up plain `string` values, which `as const`'s literal-tuple type would
// reject.
// Depends on: nothing.
// Depended on by: tests/content/topics.test.ts, tests/content/coverage.test.ts.
export const DVSA_AREAS: readonly string[] = [
  'Alertness',
  'Attitude',
  'Safety and your vehicle',
  'Safety margins',
  'Hazard awareness',
  'Vulnerable road users',
  'Other types of vehicle',
  'Vehicle handling',
  'Motorway rules',
  'Rules of the road',
  'Road and traffic signs',
  'Essential documents',
  'Incidents, accidents and emergencies',
  'Vehicle loading',
];
