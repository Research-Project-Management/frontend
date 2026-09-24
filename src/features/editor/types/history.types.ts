/**
 * history.types.ts
 *
 * Types for version history, snapshot comparisons, and change timelines.
 * Matches backend document/history module.
 */

export type VersionEventType =
  | 'manual_save'
  | 'auto_save'
  | 'collaborative_checkpoint'
  | 'restore'
  | 'file_created'
  | 'file_deleted'
  | 'asset_uploaded'
  | 'asset_deleted';

export interface VersionAuthor {
  id: string;
  name: string;
  avatar?: string;
}

export interface PageVersion {
  id: string;
  title: string;
  label: string;
  fileName: string;
  savedBy: VersionAuthor;
  createdAt: string;
  content?: string;
}

export interface PageVersionWithContent extends PageVersion {
  content: string;
}

export interface PageEvent {
  id: string;
  eventType: VersionEventType;
  title: string;
  label: string;
  fileName: string;
  savedBy: VersionAuthor;
  createdAt: string;
  /** The specific page that was modified (for content events). */
  page: string;
}

export type ProjectEvent = PageEvent;

export interface DiffChunk {
  type: 'added' | 'deleted' | 'unchanged';
  value: string;
  linesCount: number;
}

export interface VersionDiffResult {
  fromVersionId: string;
  toVersionId: string;
  fromLabel?: string;
  toLabel?: string;
  chunks: DiffChunk[];
  stats: {
    addedLines: number;
    deletedLines: number;
    unchangedLines: number;
  };
}

export interface CreateVersionInput {
  title?: string;
  content?: string;
  label?: string;
  eventType?: VersionEventType;
  fileName?: string;
  projectPageId?: string;
  projectId?: string;
}

export interface CreateSnapshotInput {
  label?: string;
}
