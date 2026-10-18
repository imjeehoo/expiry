import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { Entry, PersistedState, Unit } from '../types';
import { groupKey } from '../lib/items';
import { loadState, saveState } from '../lib/storage';

export type Action =
  | { type: 'add'; entry: Entry }
  | { type: 'remove'; id: string }
  /** Puts a removed entry back at its old position (undo). */
  | { type: 'restore'; entry: Entry; index: number }
  /** Name / weight / unit apply to the whole item; amount only to this one lot. */
  | { type: 'edit'; id: string; name: string; weight: string; unit: Unit; amount: number }
  | { type: 'import'; entries: Entry[] }
  | { type: 'undoImport'; ids: string[]; names: PersistedState['names'] }
  | { type: 'replaceAll'; entries: Entry[] }
  | { type: 'setUnit'; unit: Unit };

export function reducer(state: PersistedState, action: Action): PersistedState {
  switch (action.type) {
    case 'add':
      return {
        ...state,
        entries: [...state.entries, action.entry],
        names: { ...state.names, [action.entry.name]: { weight: action.entry.weight, unit: action.entry.unit } },
        unit: action.entry.unit,
      };
    case 'remove':
      return { ...state, entries: state.entries.filter((e) => e.id !== action.id) };
    case 'restore': {
      const entries = [...state.entries];
      entries.splice(action.index, 0, action.entry);
      return { ...state, entries };
    }
    case 'edit': {
      const target = state.entries.find((e) => e.id === action.id);
      if (!target) return state;
      const key = groupKey(target);
      const { name, weight, unit, amount } = action;
      return {
        ...state,
        entries: state.entries.map((e) => {
          if (e.id === action.id) return { ...e, name, weight, unit, amount };
          return groupKey(e) === key ? { ...e, name, weight, unit } : e;
        }),
        names: { ...state.names, [name]: { weight, unit } },
      };
    }
    case 'import': {
      const names = { ...state.names };
      for (const e of action.entries) names[e.name] = { weight: e.weight, unit: e.unit };
      return { ...state, entries: [...state.entries, ...action.entries], names };
    }
    case 'undoImport': {
      const ids = new Set(action.ids);
      return { ...state, entries: state.entries.filter((e) => !ids.has(e.id)), names: action.names };
    }
    case 'replaceAll':
      return { ...state, entries: action.entries };
    case 'setUnit':
      return { ...state, unit: action.unit };
  }
}

const StateContext = createContext<PersistedState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  useEffect(() => saveState(state), [state]);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useStore(): PersistedState {
  const s = useContext(StateContext);
  if (!s) throw new Error('useStore must be used inside <StoreProvider>');
  return s;
}

export function useDispatch(): Dispatch<Action> {
  const d = useContext(DispatchContext);
  if (!d) throw new Error('useDispatch must be used inside <StoreProvider>');
  return d;
}

/** Shared, memoised entry lookup by id. */
export function useEntry(id: string | null): Entry | undefined {
  const { entries } = useStore();
  return useMemo(() => (id ? entries.find((e) => e.id === id) : undefined), [entries, id]);
}
