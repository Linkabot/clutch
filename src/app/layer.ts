// Full-screen layer routes: which routes render a game as a fixed,
// z-index layer that covers the app shell's header band and tab bar
// (tap.css, sprint.css, pairs.css) rather than as a normal screen inside
// <main>. src/app/App.tsx and src/app/TabBar.tsx call isFullScreenLayer
// with the current pathname to make the header band and the tab bar inert
// while a layer covers them (M40), so a screen reader or keyboard user
// cannot reach either while the layer hides them underneath.
// FULL_SCREEN_ROUTES is this module's own constant, not read from
// src/features/interactives/registry's INTERACTIVES list: the Shape &
// Colour Decoder is a registry entry but renders inside <main> with the
// header's Back button and the tab bar still reachable, like any other
// screen (amendment A1, plan.md Step 3), so copying the registry would
// wrongly make it inert too. Steps 20 and 21 add the lesson and practice
// full-screen patterns to this same list.
// Depends on: nothing.
// Depended on by: src/app/App.tsx, src/app/TabBar.tsx, tests/unit/layer.test.ts.

export const FULL_SCREEN_ROUTES = ['/practice/tap', '/practice/sprint', '/practice/pairs'];

export function isFullScreenLayer(pathname: string): boolean {
  return (FULL_SCREEN_ROUTES as readonly string[]).includes(pathname);
}
