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
