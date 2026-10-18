import type { Entry } from '../../types';
import { iso } from '../../lib/dates';
import { DotsIcon } from '../common/Icons';

interface Props {
  entry: Entry;
  flash: boolean;
  onMenu: (id: string) => void;
}

export function EntryRow({ entry, flash, onMenu }: Props) {
  return (
    <div className={'row' + (flash ? ' flash' : '')}>
      <span className="rdate mono">{iso(entry.y, entry.m, entry.d)}</span>
      <span className="rqty mono">{entry.amount}x</span>
      <button type="button" className="icon-btn" aria-label="메뉴" onClick={() => onMenu(entry.id)}>
        <DotsIcon />
      </button>
    </div>
  );
}
