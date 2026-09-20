/**
 * @vitest-environment jsdom
 *
 * Render tests for the shared end screen (Q18, Q9, Q12, plan.md Step 9 and
 * amendment E16): the header's title and ✕; the band modifier class for
 * each of the three Q9 bands; no XP chip at a score of 0 and one at any
 * other; the streak chip, the optional Best chip and the optional score
 * sub-line; the "Collected!" line naming the signs it collected; one
 * lost-sign notice per Q12 loss, with its exact sentence and a "Practise
 * signs like this" button that calls onPractise with THAT sign; the gentle
 * zero line; the list heading with its muted count showing even when the
 * list is empty (scan S44) and hiding altogether when neither a count nor a
 * sign is given; one row per listed sign, each linking to its sign page;
 * and Done and Play again. Every sign name the screen prints is gameName's
 * -- asserted on gameName's own output, never on signs.json's curly-quoted
 * KYTS string (amendment E16 (b)). The pop is proved by the
 * .end-screen--animated modifier: present at a real score with motion
 * allowed, absent at zero, absent under a stubbed reduced-motion
 * matchMedia (amendment E16 (h)). Runs over the real signs catalogue.
 * Depends on: vitest, @testing-library/react, react-router-dom, jsdom (test
 * environment), src/content/signs (loadSigns, gameName, LOOK_ALIKE_PAIR),
 * src/content/schemas (Sign type),
 * src/features/interactives/shared/EndScreen.
 * Depended on by: `npm test` (Vitest run).
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { loadSigns, gameName, LOOK_ALIKE_PAIR } from '../../src/content/signs';
import type { Sign } from '../../src/content/schemas';
import EndScreen, { type EndScreenProps } from '../../src/features/interactives/shared/EndScreen';

let signs: Sign[];

beforeAll(async () => {
  signs = await loadSigns();
});

function findSign(id: string): Sign {
  const sign = signs.find((s) => s.id === id);
  if (!sign) throw new Error(`${id} missing from signs.json`);
  return sign;
}

function stubMatchMedia(matches: boolean) {
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mediaQueryList));
}

const onPractise = vi.fn<(sign: Sign) => void>();
const onDone = vi.fn<() => void>();
const onPlayAgain = vi.fn<() => void>();
const onClose = vi.fn<() => void>();

function renderEnd(overrides: Partial<EndScreenProps> = {}): HTMLElement {
  const props: EndScreenProps = {
    title: 'Tap the sign',
    onClose,
    heading: 'Round complete',
    scoreBig: '7',
    scoreText: 'of 10 right',
    band: 'orange',
    xp: 70,
    streak: 4,
    collected: [],
    lost: [],
    listHeading: 'Signs to look at again',
    listSigns: [],
    onDone,
    onPlayAgain,
    onPractise,
    ...overrides,
  };
  const view = render(
    <MemoryRouter initialEntries={['/practice/tap']}>
      <EndScreen {...props} />
    </MemoryRouter>,
  );
  return view.container;
}

function textOf(container: HTMLElement, selector: string): string | null {
  return container.querySelector(selector)?.textContent ?? null;
}

beforeEach(() => {
  onPractise.mockReset();
  onDone.mockReset();
  onPlayAgain.mockReset();
  onClose.mockReset();
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('EndScreen', () => {
  it('shows the game title, the kicker, the big score and its line', () => {
    const container = renderEnd();
    expect(textOf(container, '.end-screen__title')).toBe('Tap the sign');
    expect(textOf(container, '.end-screen__kicker')).toBe('Round complete');
    expect(textOf(container, '.end-screen__score')).toBe('7');
    expect(textOf(container, '.end-screen__score-text')).toBe('of 10 right');
    expect(container.querySelector('.end-screen__score-sub')).toBeNull();
    expect(textOf(container, '.end-screen__streak')).toBe('4-day streak');
    expect(container.querySelector('.end-screen__best')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives the panel the class of its band, one band at a time', () => {
    for (const band of ['red', 'orange', 'green'] as const) {
      const container = renderEnd({ band });
      const panel = container.querySelector('.end-screen__panel');
      expect(panel?.classList.contains(`end-screen__panel--${band}`)).toBe(true);
      for (const other of ['red', 'orange', 'green'] as const) {
        if (other === band) continue;
        expect(panel?.classList.contains(`end-screen__panel--${other}`)).toBe(false);
      }
      cleanup();
    }
  });

  it('shows no XP chip at 0, and the Best chip and sub-line only when given', () => {
    const zero = renderEnd({ scoreBig: '0', xp: 0 });
    expect(zero.querySelector('.end-screen__xp')).toBeNull();
    cleanup();

    const scored = renderEnd({ xp: 70, best: 'Best 12', scoreSub: '5 pairs matched' });
    expect(textOf(scored, '.end-screen__xp')).toBe('+70 XP');
    expect(textOf(scored, '.end-screen__best')).toBe('Best 12');
    expect(textOf(scored, '.end-screen__score-sub')).toBe('5 pairs matched');
  });

  it('shows the gentle zero line only when it is given', () => {
    const without = renderEnd();
    expect(without.querySelector('.end-screen__zero')).toBeNull();
    cleanup();

    const withLine = renderEnd({
      scoreBig: '0',
      xp: 0,
      zeroLine: 'No signs named this time — have a look at the ones below.',
    });
    expect(textOf(withLine, '.end-screen__zero')).toBe(
      'No signs named this time — have a look at the ones below.',
    );
  });

  it('names every sign collected this round on one Collected! line', () => {
    const slippery = findSign('warning-slippery-road');
    const cattle = findSign('warning-cattle');
    const container = renderEnd({ collected: [slippery, cattle] });
    expect(textOf(container, '.end-screen__collected')).toBe(
      `Collected! ${gameName(slippery)}, ${gameName(cattle)}`,
    );
    cleanup();

    expect(renderEnd().querySelector('.end-screen__collected')).toBeNull();
  });

  it('shows a lost-sign notice per loss, whose button practises THAT sign', () => {
    const slippery = findSign('warning-slippery-road');
    const cattle = findSign('warning-cattle');
    const container = renderEnd({ lost: [slippery, cattle] });

    const notices = container.querySelectorAll('.end-screen__lost');
    expect(notices).toHaveLength(2);
    expect(textOf(container, '.end-screen__lost-text')).toBe(
      `You lost ${gameName(slippery)} — 3 wrong in a row`,
    );
    expect(container.querySelectorAll('.end-screen__lost img')).toHaveLength(2);
    for (const image of container.querySelectorAll('.end-screen__lost img')) {
      expect(image.getAttribute('alt')).toBe('');
    }

    const buttons = screen.getAllByRole('button', { name: 'Practise signs like this' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(onPractise).toHaveBeenCalledTimes(1);
    expect(onPractise).toHaveBeenCalledWith(cattle);
  });

  it('shows no notice, and no Practise button, when nothing was lost', () => {
    const container = renderEnd();
    expect(container.querySelector('.end-screen__lost')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Practise signs like this' })).toBeNull();
  });

  it('lists one row per sign, each linking to its sign page', () => {
    const slippery = findSign('warning-slippery-road');
    const cattle = findSign('warning-cattle');
    const container = renderEnd({ listSigns: [slippery, cattle] });

    expect(textOf(container, '.end-screen__list-title')).toBe('Signs to look at again');
    const rows = container.querySelectorAll('.end-screen__row a.list-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('href')).toBe('/learn/signs/warning-slippery-road');
    expect(rows[1].getAttribute('href')).toBe('/learn/signs/warning-cattle');
    expect(rows[0].querySelector('.list-row__title')?.textContent).toBe(gameName(slippery));
    expect(rows[0].querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('the list heading and count show even with an empty list', () => {
    const counted = renderEnd({ listHeading: 'Missed signs', listCount: 0, listSigns: [] });
    expect(textOf(counted, '.end-screen__list-title')).toBe('Missed signs');
    expect(textOf(counted, '.end-screen__list-count')).toBe('0');
    expect(counted.querySelector('.end-screen__list')).toBeNull();
    cleanup();

    // With no count (Tap and Match Pairs), an empty list hides the heading too.
    const uncounted = renderEnd({ listSigns: [] });
    expect(uncounted.querySelector('.end-screen__list-heading')).toBeNull();
    expect(uncounted.querySelector('.end-screen__list-count')).toBeNull();
  });

  it('the two look-alike signs use their game names', () => {
    const [stop, giveWay] = LOOK_ALIKE_PAIR.map((id) => findSign(id));
    const container = renderEnd({ collected: [stop], lost: [giveWay], listSigns: [stop] });

    expect(textOf(container, '.end-screen__collected')).toBe('Collected! Stop and give way');
    expect(textOf(container, '.end-screen__lost-text')).toBe(
      'You lost Give way to traffic on major road — 3 wrong in a row',
    );
    expect(textOf(container, '.end-screen__row .list-row__title')).toBe('Stop and give way');
    // signs.json's own names use curly quotes, so they are checked as read.
    expect(container.textContent).not.toContain(stop.name);
    expect(container.textContent).not.toContain(giveWay.name);
  });

  it('pops the score when there is one, with motion allowed', () => {
    const container = renderEnd({ scoreBig: '7' });
    expect(container.querySelector('.end-screen')?.classList.contains('end-screen--animated')).toBe(
      true,
    );
  });

  it('the score does not animate at zero', () => {
    const container = renderEnd({ scoreBig: '0', xp: 0, band: 'red' });
    expect(container.querySelector('.end-screen')?.classList.contains('end-screen--animated')).toBe(
      false,
    );
  });

  it('does not animate under reduced motion, whatever the score', () => {
    stubMatchMedia(true);
    const container = renderEnd({ scoreBig: '9' });
    expect(container.querySelector('.end-screen')?.classList.contains('end-screen--animated')).toBe(
      false,
    );
    expect(container.querySelectorAll('[class*="--animated"]')).toHaveLength(0);
  });

  it('hands Done and Play again straight to their handlers', () => {
    renderEnd();
    const playAgain = screen.getByRole('button', { name: 'Play again' });
    expect(playAgain.className).toContain('button--primary');
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done.className).toContain('button--secondary');

    fireEvent.click(done);
    fireEvent.click(playAgain);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });
});
