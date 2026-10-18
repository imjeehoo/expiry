import { useEffect, type RefObject } from 'react';

/** Mirrors an element's height into --bar-h so page content can pad itself clear of the fixed bottom bar. */
export function useBarHeight(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--bar-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--bar-h');
    };
  }, [ref]);
}
