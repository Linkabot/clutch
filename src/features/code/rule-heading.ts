// Pure helper deciding whether a Highway Code rule's lead sentence needs
// its own paragraph on the rule page (Step 11, S10; amendment E5). The
// page's only <h1> is now the rule-number badge (RuleScreen.tsx), so a
// rule whose lead is not already the start of its own body text would
// otherwise lose it; Rule 126's lead ("Stopping distances.") instead
// appears after an uncaptioned diagram link and a PDF call-to-action, so
// "does not start with" would wrongly show it twice — this checks
// "does not contain" instead.
// Depends on: ../../content/text (normaliseWhitespace).
// Depended on by: src/features/code/RuleScreen.tsx,
// tests/unit/rule-heading.test.ts.
import { normaliseWhitespace } from '../../content/text';

/**
 * True when `lead` is non-empty and the whitespace-normalised `bodyText`
 * does not contain the whitespace-normalised `lead` anywhere within it.
 */
export function shouldShowLead(lead: string, bodyText: string): boolean {
  const normalisedLead = normaliseWhitespace(lead);
  if (!normalisedLead) return false;
  const normalisedBody = normaliseWhitespace(bodyText);
  return !normalisedBody.includes(normalisedLead);
}
