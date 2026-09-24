// A load-failure primitive: a screen's own content load rejected, with a
// button to retry it. The two strings are Primary's own under the autonomy
// grant (plan.md handoffs/ux-foundations/plan.md Step 7, amendment P7),
// recorded in Step 12's DECISIONS entry.
// Depends on: react, ./Button (default export, imported directly -- not
// through ./index.ts, which this module is deliberately outside of);
// styled by ./primitives.css.
// Depended on by: src/features/signs/SignScreen.tsx (imported straight from
// this file, like src/ui/ListRow.tsx; its failure state is rendered by tests/unit/sign-screen.test.tsx
// through SignScreen), src/features/interactives/match-pairs/MatchPairs.tsx,
// src/features/interactives/shared/QuestionScreen.tsx,
// src/features/interactives/sign-sprint/SprintStart.tsx.
import Button from './Button';

interface LoadFailedProps {
  onRetry: () => void;
}

function LoadFailed({ onRetry }: LoadFailedProps) {
  return (
    <div role="alert" className="load-failed">
      <p>This didn't load.</p>
      <Button variant="primary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export default LoadFailed;
