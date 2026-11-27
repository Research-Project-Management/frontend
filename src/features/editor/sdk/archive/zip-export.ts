/**
 * zip-export.ts
 *
 * Flat, data-driven Project ZIP, arXiv Submission ZIP, and Historical Version ZIP exports.
 */

import { updater } from '../pages/docs.client';
import { exportDocs } from '../pages/export.client';
import { history } from '../pages/history.client';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { sanitizeArchiveName, triggerFileDownload } from './download';

export interface ExportZipOptions {
  parentPageId: string;
  spaceId?: string;
  pageId?: string;
  projectTitle?: string;
}

export interface ExportVersionZipOptions {
  spaceId?: string;
  projectId?: string;
  parentPageId?: string;
  pageId?: string;
  version?: number | string;
  versionId?: string;
  revisionDate?: string | Date;
  revisionLabel?: string;
  projectTitle?: string;
}

interface WorkspaceZipPreset {
  mode: 'standard' | 'arxiv';
  cleanArxiv: boolean;
  includePdf: boolean;
  defaultTitle: string;
  prefix: string;
}

const WORKSPACE_ZIP_PRESETS: Record<'standard' | 'arxiv', WorkspaceZipPreset> = {
  standard: {
    mode: 'standard',
    cleanArxiv: false,
    includePdf: true,
    defaultTitle: 'flux-project',
    prefix: '',
  },
  arxiv: {
    mode: 'arxiv',
    cleanArxiv: true,
    includePdf: false,
    defaultTitle: 'manuscript',
    prefix: 'arxiv-',
  },
};

async function flushDirtyDocuments(spaceId: string): Promise<void> {
  const hasDirty =
    typeof sessionCoordinator.hasDirtyDocuments === 'function'
      ? sessionCoordinator.hasDirtyDocuments()
      : true;
  if (!hasDirty) return;

  const flushRes = await sessionCoordinator.flushAllPending().catch(() => null);
  if (!flushRes || flushRes.total > 0) {
    await updater.flushProject(spaceId).catch(() => null);
  }
}

async function downloadWorkspaceZip(
  preset: WorkspaceZipPreset,
  options: ExportZipOptions,
): Promise<string> {
  if (!options.parentPageId && !options.spaceId) {
    throw new Error('Project or page identifier is required to export ZIP.');
  }

  const store = usePageStore.getState();
  const spaceId =
    options.spaceId || store.spaceId || store.projectId || options.parentPageId;
  const pageId = options.pageId || store.rootPageId || options.parentPageId;
  const cleanTitle = sanitizeArchiveName(options.projectTitle, preset.defaultTitle);

  await flushDirtyDocuments(spaceId);

  const zipBlob = await exportDocs.exportProjectZip(spaceId, {
    cleanArxiv: preset.cleanArxiv,
    includePdf: preset.includePdf,
    mode: preset.mode,
    projectName: cleanTitle,
    ...(pageId ? { pageId } : {}),
  });

  const filename = `${preset.prefix}${cleanTitle}.zip`;
  triggerFileDownload(zipBlob, filename);
  return filename;
}

export function exportProjectAsZip(options: ExportZipOptions): Promise<string> {
  return downloadWorkspaceZip(WORKSPACE_ZIP_PRESETS.standard, options);
}

export function exportArxivSubmissionZip(options: ExportZipOptions): Promise<string> {
  return downloadWorkspaceZip(WORKSPACE_ZIP_PRESETS.arxiv, options);
}

export async function exportVersionAsZip(options: ExportVersionZipOptions): Promise<string> {
  const store = usePageStore.getState();
  const spaceId =
    options.spaceId ||
    options.projectId ||
    store.spaceId ||
    store.projectId ||
    options.parentPageId ||
    '';
  if (!spaceId) {
    throw new Error('Space ID is required to export version ZIP.');
  }

  const version = options.version ?? options.versionId ?? 1;
  const cleanTitle = sanitizeArchiveName(options.projectTitle, 'flux-project');

  await sessionCoordinator.flushAllPending().catch(() => null);

  const zipBlob = await history.exportVersionZip(
    spaceId,
    version,
    cleanTitle,
    options.pageId ? { pageId: options.pageId } : undefined,
  );

  const effectiveLabel =
    options.revisionLabel || (options.version ? `v${options.version}` : undefined);
  const suffix = effectiveLabel
    ? `-${sanitizeArchiveName(effectiveLabel, 'snapshot')}`
    : options.revisionDate
      ? `-${new Date(options.revisionDate).toISOString().slice(0, 10)}`
      : '-snapshot';

  const filename = `${cleanTitle}${suffix}.zip`;
  triggerFileDownload(zipBlob, filename);
  return filename;
}
