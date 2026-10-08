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
  getByPageId: (docId: string) => manuscriptService.history.getByDocId(docId),
  getById: (docId: string, versionId: string) => manuscriptService.history.getById(docId, versionId),
  save: (payload: any) => manuscriptService.history.save(payload),
  restore: (payload: any) => manuscriptService.history.restore(payload),
  updateLabel: (docId: string, versionId: string, label: string, title?: string) =>
    manuscriptService.history.updateLabel(docId, versionId, label, title),
  getDiff: (docId: string, fromVersionId: string, toVersionId: string) =>
    manuscriptService.history.getDiff(docId, fromVersionId, toVersionId),
  compareVersions: (docId: string, fromVersionId: string, toVersionId: string) =>
    manuscriptService.history.compareVersions(docId, fromVersionId, toVersionId),
  delete: async (_pageId: string, _versionId: string): Promise<void> => {},
};

export const PageVersionService = versionService;

export const historyService = {
  getByProjectId: (projectId: string) => manuscriptService.history.getByProjectId(projectId),
  getProjectVersions: (projectId: string) => manuscriptService.history.getProjectVersions(projectId),
  getProjectSnapshot: (projectId: string, version: number) =>
    manuscriptService.history.getProjectSnapshot(projectId, version),
  compareProjectVersions: (projectId: string, baseVersion: number, targetVersion: number) =>
    manuscriptService.history.compareProjectVersions(projectId, baseVersion, targetVersion),
  labelProjectVersion: (projectId: string, version: number, label: string) =>
    manuscriptService.history.labelProjectVersion(projectId, version, label),
  deleteProjectLabel: (projectId: string, labelId: string) =>
    manuscriptService.history.deleteProjectLabel(projectId, labelId),
  restoreProjectVersion: (projectId: string, targetVersion: number) =>
    manuscriptService.history.restoreProjectVersion(projectId, targetVersion),
  createProjectSnapshot: (
    projectId: string,
    summary?: string | { summary?: string; label?: string; isAutomatic?: boolean }
  ) => {
    const dto = typeof summary === 'string' ? { summary } : (summary ?? {});
    return manuscriptService.history.createProjectSnapshot(projectId, dto);
  },
  restoreToEvent: async (payload: { rootPageId: string; eventId?: string; versionNumber?: number }) => {
    if (payload.versionNumber) {
      return manuscriptService.history.restoreProjectVersion(payload.rootPageId, payload.versionNumber);
    }
    return [];
  },
  getTimeline: (docId: string) => manuscriptService.history.getTimeline(docId),
  getContentAt: (docId: string, versionId: string) => manuscriptService.history.getContentAt(docId, versionId),
};

export const ProjectHistoryService = historyService;

export const historyKeys = {
  all: ['project-history'] as const,
  project: (projectId: string) => ['project-history', projectId] as const,
  byProject: (projectId: string) => ['project-history', projectId] as const,
  versions: (projectId: string) => ['project-history', projectId, 'versions'] as const,
  doc: (docId: string) => ['doc-history', docId] as const,
};
