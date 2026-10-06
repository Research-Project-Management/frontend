/**
 * synctex.types.ts
 *
 * Types for bidirectional SyncTeX navigation (Editor ⇄ PDF).
 * Matches backend document/synctex module.
 */

export interface SyncPoint {
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface ReverseSyncPoint {
  file: string;
  line: number;
  column: number;
}

// Derived directly from Zod schemas (Single Source of Truth)
export type {
  ForwardSyncInput,
  ReverseSyncInput,
} from '../schemas/synctex.schema';

export interface SyncTeXMap {
  [line: number]: SyncPoint[];
}
