// Full-screen "Add to Home Screen" instructional panel (plan.md Step 11,
// amendment E25 (g), M01), shown in two places: App.tsx renders it in
// place of the whole tab shell for a first-visit iOS Safari learner who
// has not installed Clutch and has not dismissed the panel before
// (persistDismissal defaults to true, so "Not now" there writes the
// dismissal to localStorage via platform.DISMISSED_KEY, exactly as
// before); MeScreen.tsx also opens it as a layer over Me from its own Add
// to Home Screen row, with persistDismissal={false}, so re-reading it from
// Me never stores or clears a dismissal. Built from the app's own
// primitives (Button) rather than bare elements: the numbered steps are a
// CSS counter list, kept a real list for VoiceOver by role="list" now that
// list-style is none.
// Depends on: react, lucide-react (Share, SquarePlus), ../ui (Button),
// ./platform.
// Depended on by: src/app/App.tsx, src/features/me/MeScreen.tsx.
import { Share, SquarePlus } from 'lucide-react';
import { Button } from '../ui';
import { DISMISSED_KEY } from './platform';

interface AddToHomeScreenProps {
  onDismiss: () => void;
  /** Whether "Not now" writes the dismissal to localStorage. Defaults to true (the first-visit panel's original behaviour); MeScreen's own row passes false, since reopening the panel from Me must never touch DISMISSED_KEY. */
  persistDismissal?: boolean;
}

function AddToHomeScreen({ onDismiss, persistDismissal = true }: AddToHomeScreenProps) {
  const handleNotNow = () => {
    if (persistDismissal) {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    }
    onDismiss();
  };

  return (
    <div className="a2hs">
      <div className="a2hs__body">
        <h1 className="a2hs__title">Add to Home Screen</h1>
        <ol className="a2hs__steps" role="list">
          <li className="a2hs__step">
            <span className="a2hs__step-text">Tap the Share button</span>
            <Share size={24} className="a2hs__glyph" aria-hidden="true" />
          </li>
          <li className="a2hs__step">
            <span className="a2hs__step-text">Tap &quot;Add to Home Screen&quot;</span>
            <SquarePlus size={24} className="a2hs__glyph" aria-hidden="true" />
          </li>
          <li className="a2hs__step">
            <span className="a2hs__step-text">Tap Add</span>
          </li>
        </ol>
      </div>
      <div className="a2hs__actions">
        <Button variant="secondary" onClick={handleNotNow}>
          Not now
        </Button>
      </div>
    </div>
  );
}

export default AddToHomeScreen;
