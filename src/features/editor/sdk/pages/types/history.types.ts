/**
 * history.types.ts
 * DTOs for version history, diffs, op-log timelines, and file restoration.
 */

import type {
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  ProjectFileDiff,
  VersionLabelItem,
} from '@/features/editor/domain/types/history.types';

export type {
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  ProjectFileDiff,
  VersionLabelItem,
};

interface DiffChunk {
  type: 'added' | 'removed' | 'deleted' | 'unchanged' | 'change';
  lines?: string[];
  oldStart?: number;
  oldLines?: number;
  newStart?: number;
  newLines?: number;
  content?: string;
  value?: string;
  linesCount?: number;
}

export interface VersionDiffResponse {
  fromVersionId: string;
  toVersionId: string;
  fromContent?: string;
  toContent?: string;
  diff?: string;
  chunks?: DiffChunk[];
  stats?: {
    additions?: number;
    deletions?: number;
    addedLines?: number;
    deletedLines?: number;
    unchangedLines?: number;
  };
}

interface OpLogEntry {
  id?: string;
  timestamp: number;
  userId?: string;
  userName?: string;
  operation?: string;
  description?: string;
  [key: string]: unknown;
}

export interface OpLogTimeline {
  entries: OpLogEntry[];
  oldestMs?: number;
  newestMs?: number;
}

export interface ReconstructedContent {
  content?: string;
  timestamp?: number;
}

export interface RestoreProjectVersionFileResult {
  path?: string;
  pathname?: string;
  version?: number;
  newVersion?: number;
  docId?: string | null;
  fileId?: string | null;
  content?: string;
  rev?: number;
  restored?: boolean;
  [key: string]: unknown;
}
