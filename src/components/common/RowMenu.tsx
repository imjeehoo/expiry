import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Unit } from '../../types';
import { iso } from '../../lib/dates';
import { blurActive, shake } from '../../lib/dom';
import { formatWeight } from '../../lib/weight';
import { useEntryActions } from '../../hooks/useEntryActions';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { useToast } from '../../hooks/useToast';
import { useDispatch, useEntry } from '../../state/store';
import { UnitPicker } from './UnitPicker';

interface Props {
  entryId: string;
  onClose: () => void;
  /** Called after a successful edit, with the edited entry's id. */
  onSaved?: (id: string) => void;
}

/** Bottom sheet for one lot: choose Edit or Delete; Edit changes name / weight / count. */
export function RowMenu({ entryId, onClose, onSaved }: Props) {
  const entry = useEntry(entryId);
  const dispatch = useDispatch();
  const toast = useToast();
  const { remove } = useEntryActions();
  const inset = useKeyboardInset();

  // keep the latest onClose without re-running the open effect (which would blur the edit field)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const [mode, setMode] = useState<'menu' | 'edit'>('menu');
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<Unit>('g');
  const [amount, setAmount] = useState('');

  // Opening the sheet closes the keyboard; the page behind doesn't scroll.
  useEffect(() => {
    blurActive();
    document.body.classList.add('sheet-open');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('sheet-open');
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!entry) return null;

  const startEdit = () => {
    setName(entry.name);
    setWeight(entry.weight);
    setUnit(entry.unit);
    setAmount(String(entry.amount));
    setMode('edit');
  };

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { shake(e.currentTarget.querySelector('.ef')); return; }
    dispatch({ type: 'edit', id: entry.id, name: trimmed, weight: weight.trim(), unit, amount: parseInt(amount, 10) || 1 });
    toast.show('수정됨');
    onSaved?.(entry.id);
    onClose();
  };

  const title = `${entry.name}${entry.weight ? ' ' + formatWeight(entry.weight, entry.unit) : ''} · ${iso(entry.y, entry.m, entry.d).slice(2)} · ${entry.amount}x`;

  return (
    <div className="sheet">
      <div className="scrim" onClick={onClose} />
      <div className="panel" role="dialog" aria-modal="true" aria-label={title} style={inset ? { transform: `translateY(${-inset}px)` } : undefined}>
        <div className="sheet-title">{title}</div>

        {mode === 'menu' ? (
          <div className="menu">
            <button type="button" onClick={startEdit}>수정</button>
            <button type="button" className="danger" onClick={() => { onClose(); remove(entry.id); }}>삭제</button>
            <button type="button" className="cancel" onClick={onClose}>취소</button>
          </div>
        ) : (
          <form className="edit-form" autoComplete="off" noValidate onSubmit={save}>
            <label className="ef">
              <span className="label">이름</span>
              <input
                autoFocus type="text" value={name} enterKeyHint="next" autoCapitalize="sentences" autoCorrect="off" spellCheck={false}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.querySelector<HTMLInputElement>('#eWeight')?.focus(); } }}
              />
            </label>
            <div className="ef">
              <label className="label" htmlFor="eWeight">무게</label>
              <div className="weight-row">
                <input
                  id="eWeight" className="mono" type="text" inputMode="decimal" placeholder="0" value={weight} enterKeyHint="next"
                  onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.form?.querySelector<HTMLInputElement>('#eAmount')?.focus(); } }}
                />
                <UnitPicker value={unit} onChange={setUnit} />
              </div>
            </div>
            <label className="ef">
              <span className="label">수량</span>
              <input
                id="eAmount" className="mono" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="1x" value={amount} enterKeyHint="done"
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6))}
              />
            </label>
            <p className="ef-note">이름과 무게는 이 품목의 모든 날짜에 적용돼요.</p>
            <div className="btns">
              <button type="button" className="ghost" onClick={onClose}>취소</button>
              <button type="submit" className="primary">저장</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
