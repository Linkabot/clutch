// Renders sanitised Highway Code HTML (produced by the ingestion parser,
// scripts/lib/highway-code-parse.ts) via dangerouslySetInnerHTML, with
// internal hrefs base-prefixed at render time (S5) and one delegated
// click handler: an anchor whose href resolves to an in-app path via
// hc-links' routerPathFromHref is intercepted and sent through the
// router instead of a full page reload, but only when shouldIntercept
// allows it (no modifier key, primary button, not already prevented, no
// target="_blank" — C-S2); every other anchor is left alone, since
// ingestion already gives external/asset links rel="external noopener"
// target="_blank".
// Each HcHtml renders exactly one sanitised fragment. Never join two
// sanitised strings into one dangerouslySetInnerHTML call: that
// isolation is load-bearing for the sanitiser's safety (review F-S2).
// Depends on: react-router-dom (useNavigate); ./hc-links
// (prefixInternalHrefs, routerPathFromHref, shouldIntercept); styled by
// ./hc-html.css.
// Depended on by: src/features/code/SectionScreen.tsx,
// src/features/code/RuleScreen.tsx.
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import './hc-html.css';
import { prefixInternalHrefs, routerPathFromHref, shouldIntercept } from './hc-links';

interface HcHtmlProps {
  html: string;
}

function HcHtml({ html }: HcHtmlProps) {
  const navigate = useNavigate();

  function handleClick(event: MouseEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    const routerPath = routerPathFromHref(href, import.meta.env.BASE_URL);
    if (!routerPath) return;

    const intercept = shouldIntercept(
      {
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        defaultPrevented: event.defaultPrevented,
      },
      anchor.getAttribute('target'),
    );
    if (!intercept) return;

    event.preventDefault();
    navigate(routerPath);
  }

  // html is sanitised by scripts/lib/highway-code-parse.ts at ingestion
  // time (allowlisted tags/attributes only) — never raw gov.uk markup.
  return (
    <div
      className="hc-html"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: prefixInternalHrefs(html, import.meta.env.BASE_URL) }}
    />
  );
}

export default HcHtml;
