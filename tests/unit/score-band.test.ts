// Unit tests for score bands (src/engine/score-band.ts, Q9): the red/orange/
// green thresholds against a round's maximum, and Sign Sprint's maximum
// score at each round length.
// Depends on: vitest, src/engine/score-band.ts.
// Depended on by: `npm test` (Vitest run).

import { describe, it, expect } from 'vitest';
import { scoreBand, sprintBandMax } from '../../src/engine/score-band';

describe('scoreBand', () => {
  it('Tap /10: 5 red, 6 orange, 8 orange, 9 green', () => {
    expect(scoreBand(5, 10)).toBe('red');
    expect(scoreBand(6, 10)).toBe('orange');
    expect(scoreBand(8, 10)).toBe('orange');
    expect(scoreBand(9, 10)).toBe('green');
  });

  it('Pairs /5: 2 red, 3 orange, 4 orange, 5 green', () => {
    expect(scoreBand(2, 5)).toBe('red');
    expect(scoreBand(3, 5)).toBe('orange');
    expect(scoreBand(4, 5)).toBe('orange');
    expect(scoreBand(5, 5)).toBe('green');
  });

  it('Sprint 1m: 5 red, 6 orange, 9 green, 14 green', () => {
    const max = sprintBandMax('1m');
    expect(scoreBand(5, max)).toBe('red');
    expect(scoreBand(6, max)).toBe('orange');
    expect(scoreBand(9, max)).toBe('green');
    expect(scoreBand(14, max)).toBe('green');
  });

  it('Sprint 30s: 2 red, 3 orange, 5 green', () => {
    const max = sprintBandMax('30s');
    expect(scoreBand(2, max)).toBe('red');
    expect(scoreBand(3, max)).toBe('orange');
    expect(scoreBand(5, max)).toBe('green');
  });

  it('Sprint 5m: sprintBandMax is 50, and 29/30/44/45 are red/orange/orange/green', () => {
    expect(sprintBandMax('5m')).toBe(50);
    expect(scoreBand(29, sprintBandMax('5m'))).toBe('red');
    expect(scoreBand(30, sprintBandMax('5m'))).toBe('orange');
    expect(scoreBand(44, sprintBandMax('5m'))).toBe('orange');
    expect(scoreBand(45, sprintBandMax('5m'))).toBe('green');
  });

  it('a max of 0 is always red', () => {
    expect(scoreBand(0, 0)).toBe('red');
    expect(scoreBand(5, 0)).toBe('red');
  });
});
