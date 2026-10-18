import type { Group } from '../../types';
import { formatWeight } from '../../lib/weight';
import { EntryRow } from './EntryRow';

interface Props {
  group: Group;
  flashId: string | null;
  onAddTo: (group: Group) => void;
  onMenu: (id: string) => void;
}

/** One item: a header (tap to add more dates to it) and its lots, earliest date first. */
export function ItemGroup({ group, flashId, onAddTo, onMenu }: Props) {
  const weight = group.weight ? formatWeight(group.weight, group.unit) + ' · ' : '';
  return (
    <div className="group">
      <button type="button" className="group-head" onClick={() => onAddTo(group)}>
        <span className="gname">{group.name}</span>
        <span className="gmeta mono">{weight}{group.total}x</span>
      </button>
      {group.rows.map((e) => (
        <EntryRow key={e.id} entry={e} flash={e.id === flashId} onMenu={onMenu} />
      ))}
    </div>
  );
}
