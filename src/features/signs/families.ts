// Sign family metadata for the Learn card, Signs browser and (Step 20) the
// sign page's family pill: display order plus three labels per family --
// `chip` (the short chip/pill text, e.g. "Warning"), `pill` (the longer
// "<Family> signs" text shown as the sign page's family pill, e.g. "Warning
// signs") and `allLabel` (the Signs browser toggle's "All ..." text, e.g.
// "All warning signs"). The pseudo-family "all" (every family at once) is
// not a SignFamily value, so its own chip/label text is exported
// separately as ALL_CHIP_LABEL and ALL_SIGNS_LABEL.
// Depends on: ../../content/schemas (SignFamily type only).
// Depended on by: src/features/signs/SignsScreen.tsx, src/features/signs/SignScreen.tsx,
// src/features/interactives/sign-sprint/SprintStart.tsx,
// src/features/practice/tap/TapTheSignScreen.tsx,
// tests/unit/signs-filter.test.ts.

import type { SignFamily } from '../../content/schemas';

export interface FamilyMeta {
  id: SignFamily;
  chip: string;
  pill: string;
  allLabel: string;
}

export const FAMILIES: FamilyMeta[] = [
  { id: 'warning', chip: 'Warning', pill: 'Warning signs', allLabel: 'All warning signs' },
  {
    id: 'orders',
    chip: 'Orders',
    pill: 'Signs giving orders',
    allLabel: 'All signs giving orders',
  },
  { id: 'motorway', chip: 'Motorway', pill: 'Motorway signs', allLabel: 'All motorway signs' },
  { id: 'direction', chip: 'Direction', pill: 'Direction signs', allLabel: 'All direction signs' },
  {
    id: 'information',
    chip: 'Information',
    pill: 'Information signs',
    allLabel: 'All information signs',
  },
  {
    id: 'road-works',
    chip: 'Road works',
    pill: 'Road works signs',
    allLabel: 'All road works signs',
  },
];

/** The "all families" chip's own text (not a SignFamily value). */
export const ALL_CHIP_LABEL = 'All';

/** The "all families" pseudo-family's pill/toggle text (both the same, per plan.md Step 19). */
export const ALL_SIGNS_LABEL = 'All signs';

/** Looks up a family's display metadata; throws for an id not in FAMILIES (a schema/content mismatch). */
export function familyMeta(id: SignFamily): FamilyMeta {
  const meta = FAMILIES.find((family) => family.id === id);
  if (!meta) {
    throw new Error(`unknown sign family: ${id}`);
  }
  return meta;
}
