// Renders sanitised Highway Code HTML (produced by the ingestion parser,
// scripts/lib/highway-code-parse.ts) via dangerouslySetInnerHTML, with one
// delegated click handler: anchors whose href starts with /code/rule/ or
// /learn/code/ are intercepted and sent through the router instead of a
// full page reload; every other anchor is left alone, since ingestion
// already gives external/asset links rel="external noopener"
// target="_blank".
// Depends on: react-router-dom (useNavigate); styled by ./hc-html.css.
// Depended on by: src/features/code/SectionScreen.tsx,
// src/features/code/RuleScreen.tsx.
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import './hc-html.css';

interface HcHtmlProps {
  html: string;
}

const INTERNAL_LINK_PREFIXES = ['/code/rule/', '/learn/code/'];

function HcHtml({ html }: HcHtmlProps) {
  const navigate = useNavigate();

  function handleClick(event: MouseEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    if (INTERNAL_LINK_PREFIXES.some((prefix) => href.startsWith(prefix))) {
      event.preventDefault();
      navigate(href);
    }
  }

  // html is sanitised by scripts/lib/highway-code-parse.ts at ingestion
  // time (allowlisted tags/attributes only) — never raw gov.uk markup.
  return (
    <div className="hc-html" onClick={handleClick} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export default HcHtml;
