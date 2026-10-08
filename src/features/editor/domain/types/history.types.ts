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

// Derived directly from Zod schemas (Single Source of Truth)
export type {
  CreateVersionInput,
  CreateSnapshotInput,
} from './schemas/history.schema';

export interface VersionLabelItem {
  id: string;
  version: number;
  label: string;
  createdById?: string | null;
  createdAt: string;
}

export interface ProjectVersionListItem {
  id: string;
  projectId: string;
  version: number;
  summary?: string | null;
  createdById?: string | null;
  isAutomatic: boolean;
  fileCount: number;
  labels: VersionLabelItem[];
  createdAt: string;
}

export interface FileSnapshotDto {
  path: string;
  lines?: string[];
  content?: string;
  type?: 'doc' | 'file';
  hash?: string;
}

export interface ProjectSnapshotDetail extends ProjectVersionListItem {
  files: Record<string, FileSnapshotDto | string>;
}

export type FileDiffStatus = 'added' | 'deleted' | 'modified' | 'renamed' | 'unchanged';

export interface WordDiffToken {
  type: 'added' | 'deleted' | 'unchanged';
  text: string;
}

export interface DiffLine {
  type: 'added' | 'deleted' | 'unchanged';
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  words?: WordDiffToken[];
}

export interface DiffHunk {
  oldStartLine: number;
  oldLineCount: number;
  newStartLine: number;
  newLineCount: number;
  lines: DiffLine[];
  header?: string;
}

export interface ProjectFileDiff {
  path: string;
  status: FileDiffStatus;
  type: 'doc' | 'file';
  oldPath?: string;
  oldHash?: string;
  newHash?: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface ProjectDiffResponse {
  baseVersion: number;
  targetVersion: number;
  totalAdditions: number;
  totalDeletions: number;
  filesChanged: number;
  files: ProjectFileDiff[];
}
