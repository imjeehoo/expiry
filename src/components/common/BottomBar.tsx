import { useRef, type ReactNode, type Ref } from 'react';
import { useBarHeight } from '../../hooks/useBarHeight';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';

interface Props {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
  /** Rides above the on-screen keyboard (add screen). */
  followKeyboard?: boolean;
}

/** Fixed bottom bar. Publishes its height as --bar-h; tapping it never dismisses the keyboard. */
export function BottomBar({ children, ref, followKeyboard = false }: Props) {
  const own = useRef<HTMLDivElement>(null);
  const inset = useKeyboardInset();
  useBarHeight(own);
  const lift = followKeyboard ? inset : 0;

  return (
    <div
      className={'bar' + (lift > 40 ? ' kb' : '')}
      ref={(node) => {
        own.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      style={lift ? { transform: `translateY(${-lift}px)` } : undefined}
      onMouseDown={(e) => { if (document.activeElement?.tagName === 'INPUT') e.preventDefault(); }}
    >
      {children}
    </div>
  );
}
