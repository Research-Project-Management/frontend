/**
 * history.types.ts
 *
 * Types for version history, snapshot comparisons, and change timelines.
 */

interface VersionAuthor {
  id: string;
  name: string;
  avatar?: string;
}

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
  label?: string | null;
  fileName?: string | null;
  createdById?: string | null;
  author?: VersionAuthor | null;
  createdBy?: VersionAuthor | null;
  sizeBytes?: number;
  isAutomatic: boolean;
  fileCount: number;
  labels: VersionLabelItem[];
  createdAt: string;
}

interface FileSnapshotDto {
  path: string;
  lines?: string[];
  content?: string;
  type?: 'doc' | 'file';
  hash?: string;
  docId?: string;
  sizeBytes?: number;
}

export interface ProjectSnapshotDetail extends ProjectVersionListItem {
  files: Record<string, FileSnapshotDto | string>;
}

type FileDiffStatus = 'added' | 'deleted' | 'modified' | 'renamed' | 'unchanged';

interface WordDiffToken {
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
