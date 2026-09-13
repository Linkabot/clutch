// Rule 126's stopping-distance table: a static rendering of the six
// stopping-distance-* facts in facts.json (one row per speed the official
// chart lists) — the animated stopping-distance road is a Phase 3
// interactive and out of scope here. Each row shows the speed, then a
// thinking-distance cell and a braking-distance cell coloured like the
// official chart's own bars (amendment E6: the sign colour is the cell
// BACKGROUND, with --color-on-sign text, so contrast holds in dark mode
// too — those pairs are the ones scripts/check-contrast.mjs already
// proves), then an overall-distance cell combining the metric figure, the
// imperial figure and the car-length count for that row. A muted footnote
// repeats the car-length-average-metres fact's own statement text
// verbatim. Every number is read from facts.json at render time; nothing
// is ever invented, so if any of the seven facts this table needs (the
// six speeds plus the car-length average) is missing or malformed, the
// whole table renders nothing rather than a partial or guessed row.
// Depends on: ../../content/loaders (getFacts), ../../content/schemas
// (Fact type).
// Depended on by: src/features/code/RuleScreen.tsx (Rule 126 only).
import type { CSSProperties } from 'react';
import { getFacts } from '../../content/loaders';
import type { Fact } from '../../content/schemas';

interface StoppingDistanceRow {
  id: string;
  mph: number;
  thinkingM: number;
  brakingM: number;
  overallM: number;
  overallFt: number;
  carLengths: number;
}

function cellStyle(backgroundColor: string): CSSProperties {
  return { backgroundColor, color: 'var(--color-on-sign)' };
}

function toRow(fact: Fact): StoppingDistanceRow | null {
  const data = fact.data;
  if (!data) return null;

  const { mph, thinkingM, brakingM, overallM, overallFt, carLengths } = data;
  if (
    typeof mph !== 'number' ||
    typeof thinkingM !== 'number' ||
    typeof brakingM !== 'number' ||
    typeof overallM !== 'number' ||
    typeof overallFt !== 'number' ||
    typeof carLengths !== 'number'
  ) {
    return null;
  }

  return { id: fact.id, mph, thinkingM, brakingM, overallM, overallFt, carLengths };
}

function StoppingDistanceTable() {
  const facts = getFacts();
  const rows = facts
    .filter((fact) => fact.id.startsWith('stopping-distance-'))
    .map(toRow)
    .filter((row): row is StoppingDistanceRow => row !== null)
    .sort((a, b) => a.mph - b.mph);
  const footnote = facts.find((fact) => fact.id === 'car-length-average-metres');

  if (rows.length !== 6 || !footnote) {
    return null;
  }

  return (
    <div>
      <table data-testid="stopping-distances">
        <caption>Typical stopping distances (official Highway Code chart)</caption>
        <thead>
          <tr>
            <th scope="col">Speed</th>
            <th scope="col">Thinking</th>
            <th scope="col">Braking</th>
            <th scope="col">Overall</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.mph} mph</th>
              <td style={cellStyle('var(--color-sign-blue)')}>{row.thinkingM} m</td>
              <td style={cellStyle('var(--color-sign-red)')}>{row.brakingM} m</td>
              <td>
                {row.overallM} m · {row.overallFt} ft · {row.carLengths} car lengths
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ color: 'var(--color-muted)' }}>{footnote.statement}</p>
    </div>
  );
}

export default StoppingDistanceTable;
