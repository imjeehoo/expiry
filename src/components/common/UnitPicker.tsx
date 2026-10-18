import { UNITS, type Unit } from '../../types';

interface Props {
  value: Unit;
  onChange: (unit: Unit) => void;
}

/** g / kg / ml / L segmented control. Taps don't steal focus, so the keyboard stays up. */
export function UnitPicker({ value, onChange }: Props) {
  return (
    <div className="seg" role="radiogroup" aria-label="단위" onMouseDown={(e) => e.preventDefault()}>
      {UNITS.map((u) => (
        <button key={u} type="button" role="radio" aria-checked={u === value} onClick={() => onChange(u)}>
          {u}
        </button>
      ))}
    </div>
  );
}
