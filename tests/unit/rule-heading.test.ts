// Unit tests for src/features/code/rule-heading.ts's shouldShowLead
// (Step 11, S10; amendment E5 changes the check from "does not start
// with" to "does not contain"). The fourth case reproduces Rule 126's
// real shape: its lead sits after an uncaptioned diagram link and a PDF
// call-to-action rather than at the very start of the body text.
// Depends on: vitest, src/features/code/rule-heading.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { shouldShowLead } from '../../src/features/code/rule-heading';

describe('shouldShowLead', () => {
  it('is false when the body text already starts with the lead', () => {
    expect(
      shouldShowLead(
        'Stay safe.',
        'Stay safe. Drive at a speed that will allow you to stop well within the distance you can see to be clear.',
      ),
    ).toBe(false);
  });

  it('is true when the lead is absent from the body text', () => {
    expect(shouldShowLead('Stopping distances.', 'You should leave enough space.')).toBe(true);
  });

  it('is false when the lead is empty', () => {
    expect(shouldShowLead('', 'Some body text with no lead sentence.')).toBe(false);
  });

  it('is false when the lead appears later in the body text (Rule 126)', () => {
    expect(
      shouldShowLead(
        'Stopping distances.',
        '↗ Diagram (online) Download ‘Typical stopping distances’ (PDF, 124KB) Stopping distances. Drive at a speed that will allow you to stop well within the distance you can see to be clear.',
      ),
    ).toBe(false);
  });
});
