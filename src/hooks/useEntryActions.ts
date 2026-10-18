import { useCallback } from 'react';
import { iso } from '../lib/dates';
import { useDispatch, useStore } from '../state/store';
import { useToast } from './useToast';

/** Actions shared by every place that lists entries. */
export function useEntryActions() {
  const { entries } = useStore();
  const dispatch = useDispatch();
  const toast = useToast();

  const remove = useCallback((id: string) => {
    const index = entries.findIndex((e) => e.id === id);
    if (index < 0) return;
    const entry = entries[index];
    dispatch({ type: 'remove', id });
    toast.show(`삭제됨 ${iso(entry.y, entry.m, entry.d)} · ${entry.amount}x`, () => dispatch({ type: 'restore', entry, index }));
  }, [entries, dispatch, toast]);

  return { remove };
}
