import { useMemo } from 'react';
import { iso } from '../../lib/dates';
import { formatWeight } from '../../lib/weight';
import { useStore } from '../../state/store';
import { DotsIcon } from '../common/Icons';

interface Props {
  /** Ids added on this visit to the add screen, oldest first. */
  ids: string[];
  onMenu: (id: string) => void;
}

/** Pinned above the bottom bar: what was added in this session, newest first, so typos are easy to spot. */
export function RecentList({ ids, onMenu }: Props) {
  const { entries } = useStore();
  const rows = useMemo(() => {
    const byId = new Map(entries.map((e) => [e.id, e]));
    return ids.flatMap((id) => byId.get(id) ?? []).reverse();
  }, [entries, ids]);
  if (!rows.length) return null;

  return (
    <div className="recent">
      <div className="recent-head">이번에 추가 {rows.length}건</div>
      <div className="recent-list">
        {rows.map((e) => (
          <div className="rrow" key={e.id}>
            <span className="rname">{e.name + (e.weight ? ` ${formatWeight(e.weight, e.unit)}` : '')}</span>
            <span className="rmeta mono">{iso(e.y, e.m, e.d).slice(2)} · {e.amount}x</span>
            <button type="button" className="icon-btn" aria-label="메뉴" onClick={() => onMenu(e.id)}>
              <DotsIcon />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
