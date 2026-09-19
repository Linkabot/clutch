// Rule 126's stopping-distance table: a static rendering of the six
// stopping-distance-* facts in facts.json (one row per speed the official
// chart lists) — the animated stopping-distance road is a Phase 3
// interactive and out of scope here. Three columns (Step 11, S9): each
// speed row has the speed as a row header, then a thinking-distance cell
// and a braking-distance cell coloured like the official chart's own bars
// (amendment E6 (Step 11): the sign colour is the cell BACKGROUND, with
// --color-on-sign text, so contrast holds in dark mode too — those pairs
// are the ones scripts/check-contrast.mjs already proves), followed by its
// own full-width row spanning all three columns reading "Overall <m> m ·
// <ft> ft · <n> car lengths" with "Overall" bold. Amendment E7 (Step 11)
// styles the table to match the chosen TableB artboard (scout-e.md): full
// width with a fixed 28%/36%/36% colgroup, 6px padding on every header and
// speed-row cell, and each Overall row getting `padding: 4px 6px 8px` plus
// a `var(--color-hairline)` bottom border. The per-row coloured cells stay
// inline styles (HEADER_CELL_STYLE, cellStyle(), OVERALL_CELL_STYLE below)
// since their background colour is chosen per call; the table's own static
// layout (width, colgroup, caption, footnote) moved to ./code.css in Step
// 4 (M04) along with every other static inline style in src/features/code.
// A muted footnote repeats the car-length-average-metres fact's own
// statement text verbatim. Every number is read from facts.json at render
// time; nothing is ever invented, so if any of the seven facts this table
// needs (the six speeds plus the car-length average) is missing or
// malformed, the whole table renders nothing rather than a partial or
// guessed row.
// Depends on: ../../content/loaders (getFacts), ../../content/schemas
// (Fact type), ./code.css.
// Depended on by: src/features/code/RuleScreen.tsx (Rule 126 only).
import type { CSSProperties } from 'react';
import { getFacts } from '../../content/loaders';
import type { Fact } from '../../content/schemas';
import './code.css';

interface StoppingDistanceRow {
  id: string;
  mph: number;
  thinkingM: number;
  brakingM: number;
  overallM: number;
  overallFt: number;
  carLengths: number;
}

const HEADER_CELL_STYLE: CSSProperties = {
  padding: '6px',
  fontWeight: 700,
  textAlign: 'center',
  verticalAlign: 'middle',
};

const OVERALL_CELL_STYLE: CSSProperties = {
  padding: '4px 6px 8px',
  textAlign: 'left',
  borderBottom: '1px solid var(--color-hairline)',
};

function cellStyle(backgroundColor: string): CSSProperties {
  return {
    padding: '6px',
    textAlign: 'left',
    verticalAlign: 'middle',
    backgroundColor,
    color: 'var(--color-on-sign)',
  };
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
      <table data-testid="stopping-distances" className="stopping-table">
        <caption className="stopping-table__caption">
          Typical stopping distances (official Highway Code chart)
        </caption>
        <colgroup>
          <col className="stopping-table__col-speed" />
          <col className="stopping-table__col-distance" />
          <col className="stopping-table__col-distance" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" style={HEADER_CELL_STYLE}>
              Speed
            </th>
            <th scope="col" style={HEADER_CELL_STYLE}>
              Thinking
            </th>
            <th scope="col" style={HEADER_CELL_STYLE}>
              Braking
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((row) => [
            <tr key={row.id}>
              <th scope="row" style={HEADER_CELL_STYLE}>
                {row.mph} mph
              </th>
              <td style={cellStyle('var(--color-sign-blue)')}>{row.thinkingM} m</td>
              <td style={cellStyle('var(--color-sign-red)')}>{row.brakingM} m</td>
            </tr>,
            <tr key={`${row.id}-overall`}>
              <td colSpan={3} style={OVERALL_CELL_STYLE}>
                <strong>Overall</strong> {row.overallM} m · {row.overallFt} ft · {row.carLengths}{' '}
                car lengths
              </td>
            </tr>,
          ])}
        </tbody>
      </table>
      <p className="stopping-table__footnote">{footnote.statement}</p>
    </div>
  );
}

export default StoppingDistanceTable;
