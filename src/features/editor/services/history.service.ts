/**
 * history.service.ts
 *
 * Clean decoupled service for Editor Version History & Snapshots.
 * Delegates to unified manuscriptService.history:
 *  - Project-level snapshots, labels, diffs, and restore
 *  - Doc/page-level versions, labels, diffs, and timeline scrubbing
 */

import { manuscriptService } from './manuscript.service';
export type {
  VersionDiffResponse,
  OpLogTimeline,
  ReconstructedContent,
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  ProjectFileDiff,
} from './manuscript.service';

export const versionService = {
  getByPageId: manuscriptService.history.getByDocId,
  getById: manuscriptService.history.getById,
  save: manuscriptService.history.save,
  restore: manuscriptService.history.restore,
  updateLabel: manuscriptService.history.updateLabel,
  getDiff: manuscriptService.history.getDiff,
  compareVersions: manuscriptService.history.compareVersions,
  delete: async (_pageId: string, _versionId: string): Promise<void> => {},
};

export const PageVersionService = versionService;

export const historyService = {
  getByProjectId: manuscriptService.history.getByProjectId,
  getProjectVersions: manuscriptService.history.getProjectVersions,
  getProjectSnapshot: manuscriptService.history.getProjectSnapshot,
  compareProjectVersions: manuscriptService.history.compareProjectVersions,
  labelProjectVersion: manuscriptService.history.labelProjectVersion,
  deleteProjectLabel: manuscriptService.history.deleteProjectLabel,
  restoreProjectVersion: manuscriptService.history.restoreProjectVersion,
  createProjectSnapshot: manuscriptService.history.createProjectSnapshot,
  restoreToEvent: async (payload: { rootPageId: string; eventId?: string; versionNumber?: number }) => {
    if (payload.versionNumber) {
      return manuscriptService.history.restoreProjectVersion(payload.rootPageId, payload.versionNumber);
    }
    return [];
  },
  getTimeline: manuscriptService.history.getTimeline,
  getContentAt: manuscriptService.history.getContentAt,
};

export const ProjectHistoryService = historyService;

export const historyKeys = {
  all: ['project-history'] as const,
  project: (projectId: string) => ['project-history', projectId] as const,
  byProject: (projectId: string) => ['project-history', projectId] as const,
  versions: (projectId: string) => ['project-history', projectId, 'versions'] as const,
  doc: (docId: string) => ['doc-history', docId] as const,
};
