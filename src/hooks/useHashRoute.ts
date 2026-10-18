import { useCallback, useEffect, useState } from 'react';

const ADD_HASH = '#add';
const isAdd = () => location.hash === ADD_HASH;

/**
 * Two screens: the list (home) and the add screen at "#add". Using the hash puts the add screen on the
 * browser history, so the phone's back gesture returns to the list.
 */
export function useAddRoute() {
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isAdd()) history.replaceState(null, '', location.pathname + location.search); // never reopen mid-entry on reload
    const sync = () => setAdding(isAdd());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const open = useCallback(() => { location.hash = ADD_HASH; setAdding(true); }, []);
  const close = useCallback(() => {
    if (isAdd()) history.back();
    else setAdding(false);
  }, []);
  return { adding, open, close };
}
