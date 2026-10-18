import type { PersistedState } from '../types';

const KEY = 'expiry.v1'; // unchanged since v1 so existing data carries over

export const emptyState = (): PersistedState => ({ entries: [], names: {}, unit: 'g' });

export function loadState(): PersistedState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return emptyState();
    return {
      entries: Array.isArray(raw.entries) ? raw.entries : [],
      names: raw.names && typeof raw.names === 'object' ? raw.names : {},
      unit: raw.unit ?? 'g',
    };
  } catch {
    return emptyState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode, quota): keep working in memory */
  }
}
