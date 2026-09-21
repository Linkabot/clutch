/**
 * @vitest-environment jsdom
 *
 * Unit tests for src/features/me/markdown.tsx's renderMarkdown() (plan.md
 * Step 11 item 4, amendment E25 (f), (i)): every construct it supports --
 * #/##/### headings (h3/h4/h5), consecutive "- "/"* " lines as one ul, a
 * heading between two lists (no blank lines) still closing the first list,
 * paragraphs (both joined consecutive lines and blank-line breaks), inline
 * https:/http: links (and a javascript: link staying literal text),
 * **strong**, `code` (with nothing inside it parsed further), and literal
 * text for constructs it does not support (`<b>x</b>`, four-or-more `#`) --
 * and, against the real committed public/ATTRIBUTION.md, the exact census
 * step11-facts.md § F1 measured: 10 headings (1 h3, 4 h4, 5 h5), 5 ul, 22
 * li, 5 p, 2 code spans (lucide-react, LICENSE) and 0 a elements.
 * Depends on: vitest, @testing-library/react, node:fs, node:path, node:url,
 * jsdom (test environment), src/features/me/markdown (renderMarkdown).
 * Depended on by: `npm test` (Vitest run).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderMarkdown } from '../../src/features/me/markdown';

const __dirname = dirname(fileURLToPath(import.meta.url));

function renderMd(source: string) {
  return render(<>{renderMarkdown(source)}</>);
}

describe('renderMarkdown', () => {
  it('renders #, ## and ### lines as h3, h4 and h5', () => {
    const { container } = renderMd('# One\n\n## Two\n\n### Three');
    expect(container.querySelector('h3')?.textContent).toBe('One');
    expect(container.querySelector('h4')?.textContent).toBe('Two');
    expect(container.querySelector('h5')?.textContent).toBe('Three');
  });

  it('turns consecutive "- " lines into one ul, and consecutive "* " lines into one ul', () => {
    const { container } = renderMd('- a\n- b\n- c');
    const lists = container.querySelectorAll('ul');
    expect(lists).toHaveLength(1);
    expect(Array.from(lists[0].querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      'a',
      'b',
      'c',
    ]);

    const { container: starred } = renderMd('* x\n* y');
    const starredLists = starred.querySelectorAll('ul');
    expect(starredLists).toHaveLength(1);
    expect(starredLists[0].querySelectorAll('li')).toHaveLength(2);
  });

  it('a heading between two lists keeps them apart', () => {
    const { container } = renderMd('- a\n## H\n- b');
    const lists = container.querySelectorAll('ul');
    expect(lists).toHaveLength(2);
    expect(lists[0].querySelectorAll('li')).toHaveLength(1);
    expect(lists[1].querySelectorAll('li')).toHaveLength(1);
    const heading = container.querySelector('h4');
    expect(heading?.textContent).toBe('H');
    for (const li of container.querySelectorAll('li')) {
      expect(li.textContent).not.toBe('H');
    }
  });

  it('joins consecutive non-blank lines into one paragraph, and a blank line starts a new one', () => {
    const { container } = renderMd('one\ntwo\n\nthree');
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe('one two');
    expect(paragraphs[1].textContent).toBe('three');
  });

  it('an https: link becomes a real link', () => {
    const { container } = renderMd('See [the site](https://example.com/page).');
    const link = container.querySelector('a');
    expect(link?.textContent).toBe('the site');
    expect(link?.getAttribute('href')).toBe('https://example.com/page');
    expect(link?.getAttribute('rel')).toBe('external noopener');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.className).toBe('text-link');
  });

  it('an http: link becomes a real link', () => {
    const { container } = renderMd('[old site](http://example.com/old)');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('http://example.com/old');
    expect(link?.className).toBe('text-link');
    expect(link?.getAttribute('rel')).toBe('external noopener');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('a javascript: link stays text', () => {
    const { container } = renderMd('[click me](javascript:alert(1))');
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.textContent).toBe('[click me](javascript:alert(1))');
  });

  it('**text** becomes strong', () => {
    const { container } = renderMd('this is **bold** text');
    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('bold');
    expect(container.textContent).toBe('this is bold text');
  });

  it('`text` becomes code, and nothing inside a code span is parsed further', () => {
    const { container } = renderMd('a `**not bold** [not](https://x.test) link` span');
    const code = container.querySelector('code');
    expect(code?.textContent).toBe('**not bold** [not](https://x.test) link');
    expect(container.querySelectorAll('strong')).toHaveLength(0);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('unsupported constructs stay literal text', () => {
    const { container } = renderMd('<b>x</b>\n\n#### x');
    expect(container.textContent).toContain('<b>x</b>');
    expect(container.textContent).toContain('#### x');
    expect(container.querySelectorAll('h3, h4, h5, h6')).toHaveLength(0);
  });

  it('a # with no space after it stays text', () => {
    const { container } = renderMd('#hashtag');
    expect(container.querySelectorAll('h3, h4, h5, h6')).toHaveLength(0);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.textContent).toBe('#hashtag');
  });

  it('renders the real attribution file with the exact committed census', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'public', 'ATTRIBUTION.md'), 'utf8');
    const { container } = renderMd(source);

    const h3s = container.querySelectorAll('h3');
    const h4s = container.querySelectorAll('h4');
    const h5s = container.querySelectorAll('h5');
    expect(h3s).toHaveLength(1);
    expect(h4s).toHaveLength(4);
    expect(h5s).toHaveLength(5);

    expect(container.querySelectorAll('ul')).toHaveLength(5);
    expect(container.querySelectorAll('li')).toHaveLength(22);
    expect(container.querySelectorAll('p')).toHaveLength(5);
    expect(container.querySelectorAll('code')).toHaveLength(2);
    const codeTexts = Array.from(container.querySelectorAll('code')).map((el) => el.textContent);
    expect(codeTexts).toEqual(['lucide-react', 'LICENSE']);
    expect(container.querySelectorAll('a')).toHaveLength(0);

    for (const el of [...h3s, ...h4s, ...h5s, ...container.querySelectorAll('li, p')]) {
      expect(el.textContent?.startsWith('#')).toBe(false);
      expect(el.textContent?.startsWith('- ')).toBe(false);
    }
  });
});
