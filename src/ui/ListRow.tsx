// List-row primitive (M05): a full-width tappable row that navigates via
// react-router, with an optional leading node, a title, an optional muted
// subtitle, and a trailing node that defaults to a chevron. Purely
// presentational: no state, no side effects.
// Depends on: react (JSX only), react-router-dom (Link), lucide-react
// (ChevronRight); class names are styled by src/ui/primitives.css (imported
// once from src/main.tsx, after theme.css).
// Depended on by: tests/unit/list-row.test.tsx (later steps add screen
// consumers, e.g. the Highway Code sections list and the Learn tab).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface ListRowProps {
  to: string;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  state?: unknown;
}

function ListRow({ to, leading, title, subtitle, trailing, state }: ListRowProps) {
  return (
    <Link to={to} state={state} className="list-row">
      {leading ? <span className="list-row__leading">{leading}</span> : null}
      <span className="list-row__text">
        <span className="list-row__title">{title}</span>
        {subtitle ? <span className="list-row__subtitle">{subtitle}</span> : null}
      </span>
      <span className="list-row__trailing">
        {trailing ?? <ChevronRight size={20} aria-hidden="true" />}
      </span>
    </Link>
  );
}

export default ListRow;
