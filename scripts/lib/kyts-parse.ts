// Pure KYTS (Know Your Traffic Signs) chapter parser: walks a chapter's
// body HTML (gov.uk Content API `details.body`, node-html-parser) and
// returns every picture it finds as a `KytsPicture` — the media id and
// file name read from its `<img src>`, its caption (the same `<figure>`'s
// own `<figcaption>` text, or "" when the figure has none), the h2-h4
// sub-heading path in effect (joined with " › ", a new heading replacing
// its own level and clearing deeper ones), and the text of the `<p>`
// immediately before its `<figure>` (ignoring whitespace-only text), which
// scripts/lib/kyts-select.ts's R8 rule needs for the STOP and GIVE WAY
// signs (plan.md § Chosen signs, amended P7). Verified against the seven
// live KYTS chapter bodies (15 September 2026): every `<figure>` and
// heading is a direct child of the body's `.govspeak` wrapper, and every
// `<figure>` holds exactly one `<img>` and at most one `<figcaption>`. No
// network access and no selection logic — scripts/ingest-signs.ts supplies
// the fetched chapter body HTML and hands every picture on to
// scripts/lib/kyts-select.ts.
// Depends on: node-html-parser, ../../src/content/text.ts (htmlToText).
// Depended on by: scripts/lib/kyts-select.ts (KytsPicture, type only),
// scripts/ingest-signs.ts, scripts/verify-signs.ts,
// tests/unit/kyts-parse.test.ts (which also loads
// tests/fixtures/kyts-chapter.html), tests/unit/kyts-select.test.ts.

import { parse, NodeType } from 'node-html-parser';
import type { HTMLElement } from 'node-html-parser';
import { htmlToText } from '../../src/content/text';

/** One picture found in a KYTS chapter body, in document order. */
export interface KytsPicture {
  /** 0-based position among this chapter's pictures, in document order. */
  index: number;
  /** The image's absolute gov.uk media URL, e.g.
   * "https://assets.publishing.service.gov.uk/media/<id>/<file>.svg". */
  url: string;
  mediaId: string;
  file: string;
  /** The text of the figure's own `<figcaption>`, htmlToText-normalised, or
   * "" when the figure has none (R1 in § Chosen signs drops these). */
  caption: string;
  /** The h2-h4 heading path in effect when this picture appears, joined
   * with " › "; "" when no heading has appeared yet. */
  subHeading: string;
  /** The text of the `<p>` immediately before this picture's `<figure>`
   * (ignoring whitespace-only text between them), htmlToText-normalised, or
   * `null` when the previous top-level element is not a `<p>`, or there is
   * none. Used by R8 (plan.md amended P7) for the STOP and GIVE WAY signs;
   * `null` for every other picture. */
  precedingParagraphText: string | null;
}

const MEDIA_URL = /\/media\/([^/]+)\/([^/]+)$/;

type HeadingLevel = 0 | 1 | 2;

const HEADING_LEVEL: Readonly<Record<string, HeadingLevel>> = { h2: 0, h3: 1, h4: 2 };

/**
 * Parses one KYTS chapter's body HTML into its pictures, in document order.
 * Only the top-level children of the body's `.govspeak` wrapper are walked
 * (falling back to the body's own root when no such wrapper is present,
 * e.g. in a fixture) — every real KYTS `<figure>` and heading sits directly
 * there, never nested inside another element.
 */
export function parseChapter(bodyHtml: string): KytsPicture[] {
  const root = parse(bodyHtml);
  const container = root.querySelector('.govspeak') ?? root;
  const topLevel = container.childNodes.filter(
    (node): node is HTMLElement => node.nodeType === NodeType.ELEMENT_NODE,
  );

  const headingPath: [string | null, string | null, string | null] = [null, null, null];
  const pictures: KytsPicture[] = [];
  let index = 0;

  topLevel.forEach((el, position) => {
    const tag = el.localName;
    const headingLevel = HEADING_LEVEL[tag];

    if (headingLevel !== undefined) {
      headingPath[headingLevel] = htmlToText(el.innerHTML);
      for (let deeper = headingLevel + 1; deeper < headingPath.length; deeper += 1) {
        headingPath[deeper] = null;
      }
      return;
    }

    if (tag !== 'figure') return;

    const img = el.querySelector('img');
    if (!img) return;

    const src = img.getAttribute('src') ?? '';
    const media = MEDIA_URL.exec(src);
    if (!media) {
      throw new Error(`could not read a media id/file from image src: "${src}"`);
    }

    const figcaption = el.querySelector('figcaption');
    const caption = figcaption ? htmlToText(figcaption.innerHTML) : '';

    const previous = position > 0 ? topLevel[position - 1] : undefined;
    const precedingParagraphText =
      previous && previous.localName === 'p' ? htmlToText(previous.innerHTML) : null;

    pictures.push({
      index,
      url: src,
      mediaId: media[1],
      file: media[2],
      caption,
      subHeading: headingPath.filter((part): part is string => part !== null).join(' › '),
      precedingParagraphText,
    });
    index += 1;
  });

  return pictures;
}
