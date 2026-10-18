/** Quick left-right wiggle to flag an invalid field. */
export function shake(el: HTMLElement | null): void {
  el?.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)', offset: 0.25 }, { transform: 'translateX(6px)', offset: 0.75 }, { transform: 'translateX(0)' }],
    { duration: 300 },
  );
}

/** Drops focus from whatever is focused, which also closes the on-screen keyboard. */
export function blurActive(): void {
  const a = document.activeElement;
  if (a instanceof HTMLElement) a.blur();
}
