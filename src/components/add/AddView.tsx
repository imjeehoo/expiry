import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Group, Unit } from '../../types';
import { formatLong, iso, parseDigits, relative, typedDate } from '../../lib/dates';
import { shake } from '../../lib/dom';
import { newId } from '../../lib/items';
import { formatWeight } from '../../lib/weight';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { useDispatch, useStore } from '../../state/store';
import { BottomBar } from '../common/BottomBar';
import { RowMenu } from '../common/RowMenu';
import { UnitPicker } from '../common/UnitPicker';
import { RecentList } from './RecentList';
import { Step } from './Step';

const NAME = 0, WEIGHT = 1, DATE = 2, AMOUNT = 3;

interface Props {
  /** Continue an existing item: name and weight are prefilled and entry starts at the date. */
  seed: Group | null;
  onClose: () => void;
}

/**
 * One field at a time. Pressing Next collapses the finished field to plain text and opens the next one
 * above it; tap any finished field to change it. After the amount the lot is saved and a fresh date opens,
 * so several expiry dates of one item need no re-typing.
 */
export function AddView({ seed, onClose }: Props) {
  const { names, unit: lastUnit } = useStore();
  const dispatch = useDispatch();
  const inset = useKeyboardInset();

  const [name, setName] = useState(seed?.name ?? '');
  const [weight, setWeight] = useState(seed?.weight ?? '');
  const [unit, setUnit] = useState<Unit>(seed?.unit ?? lastUnit);
  const [digits, setDigits] = useState('');
  const [amount, setAmount] = useState('');

  const [step, setStep] = useState(seed ? DATE : NAME); // furthest step revealed
  const [editing, setEditing] = useState<number | null>(null); // earlier step reopened by tapping it
  const [notice, setNotice] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);

  const active = editing ?? step;
  const inputs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const boxes = [useRef<HTMLElement>(null), useRef<HTMLElement>(null), useRef<HTMLElement>(null), useRef<HTMLElement>(null)];
  const barRef = useRef<HTMLDivElement>(null);

  const refocus = () => setFocusTick((t) => t + 1);
  // Focus right after the render that opened the field, inside the tap that triggered it (keeps iOS's keyboard up).
  useLayoutEffect(() => { inputs[active].current?.focus({ preventScroll: true }); }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the field being typed in clear of the bar and keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = document.activeElement;
    if (!vv || !(el instanceof HTMLInputElement)) return;
    const limit = vv.offsetTop + vv.height - (barRef.current?.offsetHeight ?? 0) - 12;
    const bottom = el.getBoundingClientRect().bottom;
    if (bottom > limit) window.scrollBy(0, bottom - limit);
  }, [inset, active, recent.length]);

  const date = typedDate(digits);

  const advance = (to: number) => {
    if (editing !== null) setEditing(null);
    else setStep((s) => Math.max(s, to));
    refocus();
  };

  const reject = (index: number) => { setEditing(index); refocus(); shake(boxes[index].current); };

  const addLot = () => {
    if (!name.trim()) return reject(NAME);
    if (!date.complete || !date.valid) return reject(DATE);
    const qty = parseInt(amount, 10) || 1;
    const entry = { id: newId(), name: name.trim(), weight: weight.trim(), unit, y: date.y, m: date.m, d: date.d, amount: qty };
    dispatch({ type: 'add', entry });
    setRecent((r) => [...r, entry.id]);
    setDigits('');
    setAmount('');
    setEditing(null);
    setStep(DATE);
    setNotice(`✓ ${iso(date.y, date.m, date.d)} · ${qty}x 추가됨`);
    refocus();
  };

  const next = (from: number) => {
    if (from === NAME) { if (name.trim()) advance(WEIGHT); else shake(boxes[NAME].current); }
    else if (from === WEIGHT) advance(DATE);
    else if (from === DATE) { if (date.complete && date.valid) advance(AMOUNT); else shake(boxes[DATE].current); }
    else addLot();
  };

  const startNewItem = () => {
    setName(''); setWeight(''); setDigits(''); setAmount('');
    setStep(NAME); setEditing(null); setNotice(null);
    refocus();
  };

  const onEnter = (from: number) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); next(from); }
  };

  const onName = (value: string) => {
    setName(value);
    const known = names[value.trim()];
    if (known && !weight) { setWeight(known.weight); setUnit(known.unit); }
  };

  const onDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setDigits(value);
    setNotice(null);
    const typing = (e.nativeEvent as InputEvent).inputType?.startsWith('insert');
    const td = typedDate(value);
    if (typing && td.complete && td.valid) advance(AMOUNT);
  };

  const preview = (() => {
    if (notice) return notice;
    if (!date.complete) return digits === '' && active === DATE ? '연 월 일 6자리 · 예: 261225' : ' ';
    if (!date.valid) return `${iso(date.y, date.m, date.d)} 존재하지 않는 날짜예요`;
    return `${formatLong(date.y, date.m, date.d)} · ${relative(date.y, date.m, date.d)}`;
  })();
  const previewIsError = !notice && date.complete && !date.valid;

  return (
    <div className="add-view">
      <header className="top">
        <button type="button" className="pill ghost" onClick={onClose}>‹ 목록</button>
      </header>

      <main className="add-main">
        <div className="steps">
          <Step label="이름" open active={active === NAME} text={name.trim()} placeholder="품목 이름"
                ref={boxes[NAME]} onEdit={() => { setEditing(NAME); refocus(); }}>
            <input
              ref={inputs[NAME]} type="text" list="names" placeholder="품목 이름" value={name} aria-label="이름"
              enterKeyHint="next" autoCapitalize="sentences" autoCorrect="off" spellCheck={false}
              onChange={(e) => onName(e.target.value)} onKeyDown={onEnter(NAME)}
            />
          </Step>

          <Step label="무게" open={step >= WEIGHT} active={active === WEIGHT} text={weight.trim() ? formatWeight(weight.trim(), unit) : ''}
                placeholder="무게 없음" numeric ref={boxes[WEIGHT]} onEdit={() => { setEditing(WEIGHT); refocus(); }}>
            <div className="weight-row">
              <input
                ref={inputs[WEIGHT]} className="mono" type="text" inputMode="decimal" placeholder="0" value={weight} aria-label="무게"
                enterKeyHint="next" onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ''))} onKeyDown={onEnter(WEIGHT)}
              />
              <UnitPicker value={unit} onChange={setUnit} />
            </div>
          </Step>

          <Step label="유통기한 · 연 월 일" open={step >= DATE} active={active === DATE}
                text={date.complete && date.valid ? `${date.y}.${String(date.m).padStart(2, '0')}.${String(date.d).padStart(2, '0')}` : ''}
                placeholder="유통기한" numeric ref={boxes[DATE]} onEdit={() => { setEditing(DATE); refocus(); }}>
            <input
              ref={inputs[DATE]} className="mono" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="YY.MM.DD"
              value={parseDigits(digits).display} aria-label="유통기한" enterKeyHint="next"
              onChange={onDate} onKeyDown={onEnter(DATE)}
            />
            <p className={'preview' + (previewIsError ? ' err' : '')}>{preview}</p>
          </Step>

          <Step label="수량" open={step >= AMOUNT} active={active === AMOUNT} text={amount ? `${amount}x` : ''}
                placeholder="1x" numeric ref={boxes[AMOUNT]} onEdit={() => { setEditing(AMOUNT); refocus(); }}>
            <input
              ref={inputs[AMOUNT]} className="mono" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="1x" value={amount}
              aria-label="수량" enterKeyHint="done"
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && amount === '') { e.preventDefault(); setEditing(DATE); refocus(); } // back to the date
                else onEnter(AMOUNT)(e);
              }}
            />
          </Step>
        </div>
      </main>

      <BottomBar ref={barRef} followKeyboard>
        <RecentList ids={recent} onMenu={setMenuId} />
        <div className="btns">
          <button type="button" className="ghost" onClick={startNewItem}>새 품목</button>
          <button type="button" className="primary" onClick={() => next(active)}>{active === AMOUNT ? '추가' : '다음'}</button>
        </div>
      </BottomBar>

      <datalist id="names">
        {Object.keys(names).sort().map((n) => <option key={n} value={n} />)}
      </datalist>

      {menuId && <RowMenu entryId={menuId} onClose={() => { setMenuId(null); refocus(); }} />}
    </div>
  );
}
