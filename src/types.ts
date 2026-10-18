export const UNITS = ['g', 'kg', 'ml', 'L'] as const;
export type Unit = (typeof UNITS)[number];

/** One expiry lot of one item. */
export interface Entry {
  id: string;
  name: string;
  /** Typed weight value, kept as text so "1.5" and "500" round-trip exactly. */
  weight: string;
  unit: Unit;
  y: number;
  m: number;
  d: number;
  amount: number;
}

/** What the app remembers per item name, to prefill weight/unit next time. */
export type NameMemory = Record<string, { weight: string; unit: Unit }>;

export interface PersistedState {
  entries: Entry[];
  names: NameMemory;
  unit: Unit;
}

/** Entries that share name + weight + unit form one item (a "group"). */
export interface Group {
  key: string;
  name: string;
  weight: string;
  unit: Unit;
  rows: Entry[];
  total: number;
}
