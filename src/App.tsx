import { useLayoutEffect, useRef, useState } from 'react';
import type { Group } from './types';
import { AddView } from './components/add/AddView';
import { HomeView } from './components/home/HomeView';
import { useAddRoute } from './hooks/useHashRoute';

export default function App() {
  const { adding, open, close } = useAddRoute();
  const [seed, setSeed] = useState<Group | null>(null);
  const [session, setSession] = useState(0); // new key per visit, so the add screen always starts fresh
  const homeScroll = useRef(0);

  const openAdd = (from?: Group) => {
    homeScroll.current = window.scrollY;
    setSeed(from ?? null);
    setSession((s) => s + 1);
    open();
  };

  // Home stays mounted while adding, so coming back lands on the same scroll position.
  useLayoutEffect(() => {
    window.scrollTo(0, adding ? 0 : homeScroll.current);
  }, [adding]);

  return (
    <>
      <HomeView hidden={adding} onAdd={openAdd} />
      {adding && <AddView key={session} seed={seed} onClose={close} />}
    </>
  );
}
