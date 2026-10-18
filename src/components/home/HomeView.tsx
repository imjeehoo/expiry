import { useMemo, useState } from 'react';
import type { Group } from '../../types';
import { buildExport, saveOrShare } from '../../lib/exporter';
import { readImportFile } from '../../lib/importer';
import { groupEntries } from '../../lib/items';
import { useToast } from '../../hooks/useToast';
import { useDispatch, useStore } from '../../state/store';
import { BottomBar } from '../common/BottomBar';
import { RowMenu } from '../common/RowMenu';
import { ItemGroup } from './ItemGroup';

interface Props {
  hidden: boolean;
  /** Open the add screen, optionally continuing an existing item. */
  onAdd: (seed?: Group) => void;
}

/** Home: every item and its lots, plus import / export and the entry point to the add screen. */
export function HomeView({ hidden, onAdd }: Props) {
  const { entries, names } = useStore();
  const dispatch = useDispatch();
  const toast = useToast();
  const groups = useMemo(() => groupEntries(entries), [entries]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const doExport = async () => {
    const { blob, filename } = buildExport(entries);
    if (await saveOrShare(blob, filename)) toast.show(`${filename} 저장됨`);
  };

  const doImport = async (file: File) => {
    try {
      const res = await readImportFile(file, entries);
      if (!res) return toast.show('이름 / 유통기한 열을 찾을 수 없어요');
      if (!res.fresh.length) {
        return toast.show(res.skipped ? `가져온 항목 없음 · ${res.skipped}건 건너뜀` : '새로 가져올 항목이 없어요');
      }
      const previousNames = names;
      dispatch({ type: 'import', entries: res.fresh });
      const note = [res.duplicates && `중복 ${res.duplicates}건`, res.skipped && `${res.skipped}건 건너뜀`].filter(Boolean).join(', ');
      toast.show(`${res.fresh.length}건 가져옴${note ? ` · ${note}` : ''}`, () =>
        dispatch({ type: 'undoImport', ids: res.fresh.map((e) => e.id), names: previousNames }));
    } catch {
      toast.show('파일을 읽을 수 없어요');
    }
  };

  const clearAll = () => {
    if (!confirm(`기록 ${entries.length}건을 모두 삭제할까요?`)) return;
    const backup = entries;
    dispatch({ type: 'replaceAll', entries: [] });
    toast.show('모두 삭제됨', () => dispatch({ type: 'replaceAll', entries: backup }));
  };

  return (
    <div hidden={hidden}>
      <header className="top">
        <h1>유통기한</h1>
        <div className="actions">
          <label className="pill ghost file-pill" role="button">
            가져오기
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void doImport(f);
              }}
            />
          </label>
          <button type="button" className="pill" disabled={!entries.length} onClick={() => void doExport()}>내보내기</button>
        </div>
      </header>

      <main>
        <div className="list-head">
          <span>{entries.length ? `${entries.length}건 · ${groups.length}개 품목` : '기록 없음'}</span>
          {entries.length > 0 && <button type="button" className="link-danger" onClick={clearAll}>모두 삭제</button>}
        </div>
        <section className="list">
          {groups.length === 0 && <p className="empty">추가한 기록이 여기에 표시돼요.</p>}
          {groups.map((g) => (
            <ItemGroup key={g.key} group={g} flashId={flashId} onAddTo={onAdd} onMenu={setMenuId} />
          ))}
        </section>
      </main>

      {!hidden && (
        <BottomBar>
          <button type="button" className="primary wide" onClick={() => onAdd()}>품목 추가</button>
        </BottomBar>
      )}
      {menuId && <RowMenu entryId={menuId} onClose={() => setMenuId(null)} onSaved={setFlashId} />}
    </div>
  );
}
