/**
 * history.service.ts
 *
 * Clean decoupled service for Editor Version History & Snapshots.
 * Delegates to unified manuscriptService.history (`/api/v1/manuscripts/docs/:docId/versions`).
 */

import { manuscriptService } from './manuscript.service';
export type {
  VersionDiffResponse,
  OpLogTimeline,
  ReconstructedContent,
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
  restoreToEvent: async (_payload: { rootPageId: string; eventId: string }) => [],
  getTimeline: manuscriptService.history.getTimeline,
  getContentAt: manuscriptService.history.getContentAt,
};

export const ProjectHistoryService = historyService;
