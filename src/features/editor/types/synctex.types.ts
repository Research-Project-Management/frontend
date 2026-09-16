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

export interface ForwardSyncInput {
  file: string;
  line: number;
  column?: number;
  projectId?: string;
  pageId?: string;
}

export interface ReverseSyncInput {
  page: number;
  x: number;
  y: number;
  projectId?: string;
  pageId?: string;
}

export interface SyncTeXMap {
  [line: number]: SyncPoint[];
}
