/**
 * zip-export.ts
 *
 * GoF Template Method + Strategy Pattern for Project ZIP, arXiv Submission ZIP,
 * and Historical Version ZIP exports.
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

interface ResolvedZipContext<TOptions> {
  options: TOptions;
  spaceId: string;
  pageId?: string;
  cleanTitle: string;
}

/**
 * GoF Strategy + Template Method: Abstract base defining the invariant ZIP export skeleton:
 * 1. Resolve coordinates (`spaceId`, `pageId`, `cleanTitle`)
 * 2. Flush dirty local/Yjs documents
 * 3. Fetch authoritative PKZIP `Blob` from backend
 * 4. Compute canonical `.zip` filename & trigger browser download
 */
abstract class AbstractZipExportStrategy<TOptions> {
  protected abstract readonly defaultTitleFallback: string;

  public async execute(options: TOptions): Promise<string> {
    const ctx = this.resolveContext(options);
    await this.flushBeforeExport(ctx);
    const zipBlob = await this.fetchZipBlob(ctx);
    const filename = this.formatDownloadFilename(ctx);
    triggerFileDownload(zipBlob, filename);
    return filename;
  }

  protected abstract resolveContext(options: TOptions): ResolvedZipContext<TOptions>;
  protected abstract flushBeforeExport(ctx: ResolvedZipContext<TOptions>): Promise<void>;
  protected abstract fetchZipBlob(ctx: ResolvedZipContext<TOptions>): Promise<Blob>;
  protected abstract formatDownloadFilename(ctx: ResolvedZipContext<TOptions>): string;
}

abstract class WorkspaceProjectZipStrategy extends AbstractZipExportStrategy<ExportZipOptions> {
  protected resolveContext(options: ExportZipOptions): ResolvedZipContext<ExportZipOptions> {
    if (!options.parentPageId && !options.spaceId) {
      throw new Error('Project or page identifier is required to export ZIP.');
    }
    const store = usePageStore.getState();
    const spaceId =
      options.spaceId || store.spaceId || store.projectId || options.parentPageId;
    const pageId = options.pageId || store.rootPageId || options.parentPageId;
    const cleanTitle = sanitizeArchiveName(options.projectTitle, this.defaultTitleFallback);
    return { options, spaceId, pageId: pageId || undefined, cleanTitle };
  }

  protected async flushBeforeExport(ctx: ResolvedZipContext<ExportZipOptions>): Promise<void> {
    const hasDirty =
      typeof sessionCoordinator.hasDirtyDocuments === 'function'
        ? sessionCoordinator.hasDirtyDocuments()
        : true;
    if (!hasDirty) return;

    const flushRes = await sessionCoordinator.flushAllPending().catch(() => null);
    if (!flushRes || flushRes.total > 0) {
      await updater.flushProject(ctx.spaceId).catch(() => null);
    }
  }
}

class StandardProjectZipStrategy extends WorkspaceProjectZipStrategy {
  protected readonly defaultTitleFallback = 'flux-project';

  protected fetchZipBlob(ctx: ResolvedZipContext<ExportZipOptions>): Promise<Blob> {
    return exportDocs.exportProjectZip(ctx.spaceId, {
      cleanArxiv: false,
      includePdf: true,
      mode: 'standard',
      projectName: ctx.cleanTitle,
      ...(ctx.pageId ? { pageId: ctx.pageId } : {}),
    });
  }

  protected formatDownloadFilename(ctx: ResolvedZipContext<ExportZipOptions>): string {
    return `${ctx.cleanTitle}.zip`;
  }
}

class ArxivProjectZipStrategy extends WorkspaceProjectZipStrategy {
  protected readonly defaultTitleFallback = 'manuscript';

  protected fetchZipBlob(ctx: ResolvedZipContext<ExportZipOptions>): Promise<Blob> {
    return exportDocs.exportProjectZip(ctx.spaceId, {
      cleanArxiv: true,
      includePdf: false,
      mode: 'arxiv',
      projectName: ctx.cleanTitle,
      ...(ctx.pageId ? { pageId: ctx.pageId } : {}),
    });
  }

  protected formatDownloadFilename(ctx: ResolvedZipContext<ExportZipOptions>): string {
    return `arxiv-${ctx.cleanTitle}.zip`;
  }
}

class HistoricalVersionZipStrategy extends AbstractZipExportStrategy<ExportVersionZipOptions> {
  protected readonly defaultTitleFallback = 'flux-project';

  protected resolveContext(
    options: ExportVersionZipOptions,
  ): ResolvedZipContext<ExportVersionZipOptions> {
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
    const cleanTitle = sanitizeArchiveName(options.projectTitle, this.defaultTitleFallback);
    return { options, spaceId, pageId: options.pageId, cleanTitle };
  }

  protected async flushBeforeExport(): Promise<void> {
    await sessionCoordinator.flushAllPending().catch(() => null);
  }

  protected fetchZipBlob(ctx: ResolvedZipContext<ExportVersionZipOptions>): Promise<Blob> {
    const version = ctx.options.version ?? ctx.options.versionId ?? 1;
    return history.exportVersionZip(
      ctx.spaceId,
      version,
      ctx.cleanTitle,
      ctx.pageId ? { pageId: ctx.pageId } : undefined,
    );
  }

  protected formatDownloadFilename(ctx: ResolvedZipContext<ExportVersionZipOptions>): string {
    const { revisionLabel, version, revisionDate } = ctx.options;
    const effectiveLabel = revisionLabel || (version ? `v${version}` : undefined);
    const suffix = effectiveLabel
      ? `-${sanitizeArchiveName(effectiveLabel, 'snapshot')}`
      : revisionDate
        ? `-${new Date(revisionDate).toISOString().slice(0, 10)}`
        : '-snapshot';
    return `${ctx.cleanTitle}${suffix}.zip`;
  }
}

const STANDARD_ZIP_STRATEGY = new StandardProjectZipStrategy();
const ARXIV_ZIP_STRATEGY = new ArxivProjectZipStrategy();
const VERSION_ZIP_STRATEGY = new HistoricalVersionZipStrategy();

export function exportProjectAsZip(options: ExportZipOptions): Promise<string> {
  return STANDARD_ZIP_STRATEGY.execute(options);
}

export function exportArxivSubmissionZip(options: ExportZipOptions): Promise<string> {
  return ARXIV_ZIP_STRATEGY.execute(options);
}

export function exportVersionAsZip(options: ExportVersionZipOptions): Promise<string> {
  return VERSION_ZIP_STRATEGY.execute(options);
}
