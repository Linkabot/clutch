// Pure link helpers for the Highway Code HTML rendered by HcHtml:
// prefixInternalHrefs rewrites every internal href="/…" (never a
// protocol-relative "//…") in a sanitised html string to carry the app's
// base path at render time (S5), so a fresh cold-loaded page and a link
// clicked from within the app both land under /clutch/; routerPathFromHref
// reverses that for one clicked href, returning the in-app router path
// (without the base, matching what useNavigate expects) when the href is
// base-prefixed and internal, else null; shouldIntercept decides whether a
// click event should be taken over for client-side navigation at all — a
// non-primary button, any modifier key, an already-prevented event or
// target="_blank" all mean "let the browser handle it" (C-S2).
// Depends on: nothing (pure functions, framework-agnostic).
// Depended on by: src/features/code/HcHtml.tsx, tests/unit/hc-links.test.ts.

const HREF_ATTR = /href="(\/(?!\/)[^"]*)"/g;

const INTERNAL_ROUTER_PREFIXES = ['code/rule/', 'learn/code/'];

/** Rewrites every internal `href="/…"` in `html` to start with `base`
 * (e.g. `/code/rule/126` → `/clutch/code/rule/126`, no double slash).
 * `href="//…"` (protocol-relative), `href="http…"`, `href="mailto:…"` and
 * same-page `href="#…"` links never start with a single `/` and are left
 * untouched. */
export function prefixInternalHrefs(html: string, base: string): string {
  return html.replace(HREF_ATTR, (_match, path: string) => `href="${base}${path.slice(1)}"`);
}

/** Returns the in-app router path for a base-prefixed internal href (e.g.
 * `/clutch/code/rule/126` with base `/clutch/` → `/code/rule/126`), or
 * `null` when `href` does not start with `base` or the remainder is not
 * one of the internal link prefixes (an external, mailto: or same-page
 * href). */
export function routerPathFromHref(href: string, base: string): string | null {
  if (!href.startsWith(base)) return null;
  const path = href.slice(base.length);
  if (!INTERNAL_ROUTER_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
  return `/${path}`;
}

interface ClickLikeEvent {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

/** False for a non-primary mouse button, any modifier key, an event whose
 * default is already prevented, or an anchor with target="_blank" — every
 * one of those means the browser's own handling (new tab, download, etc.)
 * must run instead of a client-side navigate() (C-S2). True otherwise. */
export function shouldIntercept(event: ClickLikeEvent, target: string | null): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (target === '_blank') return false;
  return true;
}
