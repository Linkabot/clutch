// Minimal Markdown-to-React renderer for public/ATTRIBUTION.md (PS11, M15,
// plan.md Step 11 item 4, amendment E25 (f)): #, ## and ### lines become
// h3, h4 and h5 (a # line needs a space after the marks; four or more #
// stays literal text); consecutive "- " or "* " lines become one ul;
// other consecutive non-blank, non-list, non-heading lines join into one
// paragraph with a space. Inline parsing runs in a fixed order: code spans
// first (nothing inside backticks is parsed further), then [text](url)
// links (http: and https: only -- any other scheme, including
// javascript:, is left as the literal source text; bare web addresses are
// never turned into links), then **strong**. Every node returned is a real
// React element -- this module builds no HTML string and injects none.
// react-refresh/only-export-components (eslint.config.js) rejects an
// unexported JSX-returning helper component in a file with no component
// export, so every helper below is a plain, lower-case function rather
// than a component.
// Depends on: react (ReactNode type, createElement).
// Depended on by: src/features/me/Attribution.tsx, tests/unit/markdown.test.tsx.

import { createElement, type ReactNode } from 'react';

const HEADING_TAGS = ['h3', 'h4', 'h5'] as const;

function isBlank(line: string): boolean {
  return line.trim() === '';
}

function headingMatch(line: string): { level: 1 | 2 | 3; text: string } | null {
  const match = /^(#{1,3})(?!#)\s+(.*)$/.exec(line);
  if (!match) return null;
  return { level: match[1].length as 1 | 2 | 3, text: match[2] };
}

function listItemMatch(line: string): string | null {
  const match = /^[-*]\s+(.*)$/.exec(line);
  return match ? match[1] : null;
}

/** `**text**` becomes strong; everything else in `text` is literal. Runs last, on whatever code spans and links left behind. */
function parseStrong(text: string, key: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  const nodes: ReactNode[] = [];
  parts.forEach((part, index) => {
    if (part.length >= 4 && part.startsWith('**') && part.endsWith('**')) {
      nodes.push(createElement('strong', { key: `${key}-s${index}` }, part.slice(2, -2)));
    } else if (part !== '') {
      nodes.push(part);
    }
  });
  return nodes;
}

/** `[text](url)` becomes a link, only for http: and https: URLs; anything else (including javascript:) stays literal source text. Bare addresses are never autolinked. */
function parseLinks(text: string, key: string): ReactNode[] {
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let index = 0;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...parseStrong(text.slice(lastIndex, match.index), `${key}-l${index}`));
    }
    nodes.push(
      createElement(
        'a',
        {
          key: `${key}-a${index}`,
          className: 'text-link',
          href: match[2],
          rel: 'external noopener',
          target: '_blank',
        },
        match[1],
      ),
    );
    lastIndex = linkPattern.lastIndex;
    index += 1;
  }
  if (lastIndex < text.length) {
    nodes.push(...parseStrong(text.slice(lastIndex), `${key}-l${index}`));
  }
  return nodes;
}

/** `` `text` `` becomes code, first, so nothing inside a code span is parsed by parseLinks or parseStrong. */
function parseInline(text: string, key: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`)/);
  const nodes: ReactNode[] = [];
  parts.forEach((part, index) => {
    if (part.length >= 2 && part.startsWith('`') && part.endsWith('`')) {
      nodes.push(createElement('code', { key: `${key}-c${index}` }, part.slice(1, -1)));
    } else if (part !== '') {
      nodes.push(...parseLinks(part, `${key}-${index}`));
    }
  });
  return nodes;
}

/** Renders `source` as a small, fixed set of block elements: headings, lists and paragraphs, each inline-parsed. */
export function renderMarkdown(source: string): ReactNode[] {
  const lines = source.split(/\r\n|\r|\n/);
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockIndex = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i += 1;
      continue;
    }

    const heading = headingMatch(line);
    if (heading) {
      const key = `b${blockIndex}`;
      blocks.push(
        createElement(HEADING_TAGS[heading.level - 1], { key }, ...parseInline(heading.text, key)),
      );
      blockIndex += 1;
      i += 1;
      continue;
    }

    if (listItemMatch(line) !== null) {
      const key = `b${blockIndex}`;
      const items: string[] = [];
      while (i < lines.length && !isBlank(lines[i])) {
        const item = listItemMatch(lines[i]);
        if (item === null) break;
        items.push(item);
        i += 1;
      }
      blocks.push(
        createElement(
          'ul',
          { key },
          items.map((item, itemIndex) =>
            createElement('li', { key: itemIndex }, ...parseInline(item, `${key}-i${itemIndex}`)),
          ),
        ),
      );
      blockIndex += 1;
      continue;
    }

    const key = `b${blockIndex}`;
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !headingMatch(lines[i]) &&
      listItemMatch(lines[i]) === null
    ) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(createElement('p', { key }, ...parseInline(paragraphLines.join(' '), key)));
    blockIndex += 1;
  }

  return blocks;
}
