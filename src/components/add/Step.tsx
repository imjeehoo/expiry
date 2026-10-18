import type { ReactNode, Ref } from 'react';

interface Props {
  label: string;
  /** Revealed yet? Steps open one at a time, newest on top. */
  open: boolean;
  /** The one being typed in; the others collapse to tappable text. */
  active: boolean;
  /** Finished value shown as plain text (empty -> placeholder). */
  text: string;
  placeholder: string;
  numeric?: boolean;
  onEdit: () => void;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
}

export function Step({ label, open, active, text, placeholder, numeric, onEdit, ref, children }: Props) {
  return (
    <section ref={ref} className={'step' + (open ? ' open' : '') + (active ? ' active' : '')} aria-hidden={!open}>
      <div className="inner">
        <span className="label">{label}</span>
        <button type="button" className={'val' + (text ? (numeric ? ' num' : '') : ' empty')} tabIndex={active ? -1 : 0} onClick={onEdit}>
          {text || placeholder}
        </button>
        <div className="edit">{children}</div>
      </div>
    </section>
  );
}
