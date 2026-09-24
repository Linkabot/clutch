// SignImage: the only component that renders a real Know Your Traffic
// Signs picture, always through a plain <img src>, never inlined,
// animated, recoloured or transformed (plan.md D7, § Rules "Real sign
// pictures"). `alt` is passed straight through so each caller sets it for
// its own context (empty where the caption is shown alongside the
// picture; a neutral label such as "Sign to name" or "Option A" in games,
// so the alt text never gives away a game's answer).
// Depends on: src/content/schemas (Sign, type only),
// src/content/signs.ts (signImageUrl).
// Depended on by: src/features/signs/SignScreen.tsx,
// src/features/signs/SignsScreen.tsx, src/features/learn/LearnScreen.tsx,
// src/features/journey/JourneyScreen.tsx,
// src/features/practice/PracticeScreen.tsx,
// src/features/practice/tap/TapTheSignScreen.tsx,
// src/features/interactives/shared/EndScreen.tsx,
// src/features/interactives/sign-sprint/SignSprint.tsx,
// src/features/interactives/match-pairs/MatchPairs.tsx,
// src/features/interactives/shape-colour-decoder/Decoder.tsx,
// tests/unit/interactives-render.test.tsx.

import type { Sign } from '../../../content/schemas';
import { signImageUrl } from '../../../content/signs';

interface SignImageProps {
  sign: Sign;
  alt: string;
}

function SignImage({ sign, alt }: SignImageProps) {
  return <img src={signImageUrl(sign)} alt={alt} decoding="async" draggable={false} />;
}

export default SignImage;
