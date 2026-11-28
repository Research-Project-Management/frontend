/**
 * zip-export.ts
 *
 * Workspace ZIP, arXiv submission ZIP, and historical version ZIP exports.
 */

import { exportDocs } from '../pages/export.client';
import { history } from '../pages/history.client';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { resolveEditorScope } from '@/features/editor/core/coordinator/editor-scope';
import { sanitizeArchiveName, triggerFileDownload } from './download';

export interface ExportZipOptions {
  spaceId?: string;
  pageId?: string;
  title?: string;
}

export interface ExportVersionZipOptions {
  spaceId?: string;
  pageId?: string;
  version?: number | string;
  versionId?: string;
  revisionDate?: string | Date;
  revisionLabel?: string;
  title?: string;
}

interface ZipPreset {
  mode: 'standard' | 'arxiv';
  cleanArxiv: boolean;
  includePdf: boolean;
  defaultTitle: string;
  prefix: string;
}

const ZIP_PRESETS: Record<'standard' | 'arxiv', ZipPreset> = {
  standard: {
    mode: 'standard',
    cleanArxiv: false,
    includePdf: true,
    defaultTitle: 'flux-archive',
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

async function downloadZip(preset: ZipPreset, options: ExportZipOptions): Promise<string> {
  if (!options.pageId && !options.spaceId) {
    throw new Error('Space or page identifier is required to export ZIP.');
  }

  const scope = resolveEditorScope({ spaceId: options.spaceId, pageId: options.pageId });
  const spaceId = scope.effectiveScopeId;
  const pageId = options.pageId || scope.rootPageId || undefined;
  const cleanTitle = sanitizeArchiveName(options.title, preset.defaultTitle);

  await sessionCoordinator.syncBeforeServerRead(spaceId);

  const zipBlob = await exportDocs.exportZip(spaceId, {
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

export function exportZip(options: ExportZipOptions): Promise<string> {
  return downloadZip(ZIP_PRESETS.standard, options);
}

export function exportArxivZip(options: ExportZipOptions): Promise<string> {
  return downloadZip(ZIP_PRESETS.arxiv, options);
}

export async function exportVersionZip(options: ExportVersionZipOptions): Promise<string> {
  const spaceId = resolveEditorScope({
    spaceId: options.spaceId,
    pageId: options.pageId,
  }).effectiveScopeId;
  if (!spaceId) {
    throw new Error('Space ID is required to export version ZIP.');
  }

  const version = options.version ?? options.versionId;
  if (version === undefined || version === null || String(version).trim() === '') {
    throw new Error('Version identifier is required to export version ZIP.');
  }

  const cleanTitle = sanitizeArchiveName(options.title, 'flux-archive');
  await sessionCoordinator.syncBeforeServerRead(spaceId);

  const zipBlob = await history.exportVersionZip(
    spaceId,
    version,
    cleanTitle,
    options.pageId ? { pageId: options.pageId } : undefined,
  );

  const effectiveLabel =
    options.revisionLabel || (options.version ? `v${options.version}` : undefined);
  let suffix = '-snapshot';
  if (effectiveLabel) {
    suffix = `-${sanitizeArchiveName(effectiveLabel, 'snapshot')}`;
  } else if (options.revisionDate) {
    const parsedDate = new Date(options.revisionDate);
    if (!Number.isNaN(parsedDate.getTime())) {
      suffix = `-${parsedDate.toISOString().slice(0, 10)}`;
    }
  }

  const filename = `${cleanTitle}${suffix}.zip`;
  triggerFileDownload(zipBlob, filename);
  return filename;
}
