/**
 * document-manifest.store.ts
 *
 * Per-document manifest metadata registry, path matching, folder prefix rewrites,
 * and offline spill persistence/hydration helpers for LRUDocumentCache (Domain Layer - Pure).
 */

import type { IDocumentSpillSink } from '@/features/editor/domain/offline-storage';
import {
  normalizeVirtualPath,
  rewritePathPrefix,
} from './document-naming';
import { measureUtf8Bytes } from './lru-linked-list';

export interface DocumentManifestEntry {
  rev?: number;
  hash?: string | null;
  sizeBytes?: number;
  sessionValidated?: boolean;
}

export interface ManifestTreeNode {
  type?: string;
  id?: string;
  docId?: string | null;
  hash?: string | null;
  rev?: number | null;
  sizeBytes?: number;
  isRootDoc?: boolean;
  children?: unknown[];
}

export class DocumentManifestStore {
  private readonly manifestByDocId = new Map<string, DocumentManifestEntry>();

  public setEntry(fileId: string, entry: DocumentManifestEntry): void {
    if (!fileId) return;
    const prev = this.manifestByDocId.get(fileId) ?? {};
    this.manifestByDocId.set(fileId, {
      ...prev,
      ...(entry.rev !== undefined ? { rev: entry.rev } : {}),
      ...(entry.hash !== undefined ? { hash: entry.hash } : {}),
      ...(entry.sizeBytes !== undefined ? { sizeBytes: entry.sizeBytes } : {}),
      ...(entry.sessionValidated !== undefined
        ? { sessionValidated: entry.sessionValidated }
        : prev.sessionValidated !== undefined
          ? { sessionValidated: prev.sessionValidated }
          : {}),
    });
  }

  public getEntry(fileId: string): DocumentManifestEntry | undefined {
    return this.manifestByDocId.get(fileId);
  }

  public hydrateFromTree(
    nodes: ReadonlyArray<ManifestTreeNode>,
    options?: { rootDocId?: string; pageId?: string },
  ): void {
    if (!Array.isArray(nodes)) return;
    const visit = (list: ReadonlyArray<ManifestTreeNode>) => {
      for (const node of list) {
        if (!node) continue;
        const upperType = node.type?.toUpperCase();
        if (!upperType || upperType === 'DOC') {
          const docId = node.docId || node.id;
          if (docId) {
            const entry: DocumentManifestEntry = {
              ...(node.hash !== undefined ? { hash: node.hash } : {}),
              ...(typeof node.rev === 'number' ? { rev: node.rev } : {}),
              ...(typeof node.sizeBytes === 'number' ? { sizeBytes: node.sizeBytes } : {}),
              sessionValidated: true,
            };
            this.setEntry(docId, entry);
            if (
              (node.isRootDoc || docId === options?.rootDocId) &&
              options?.pageId &&
              options.pageId !== docId
            ) {
              this.setEntry(options.pageId, entry);
            }
          }
        }
        if (Array.isArray(node.children) && node.children.length > 0) {
          visit(node.children as ReadonlyArray<ManifestTreeNode>);
        }
      }
    };
    visit(nodes);
  }

  public isSyncedCacheFreshAgainstManifest(
    fileId: string,
    cached: { rev?: number; hash?: string | null },
  ): boolean {
    const manifest = this.manifestByDocId.get(fileId);
    if (!manifest) return false;
    if (manifest.hash && cached.hash) {
      return manifest.hash === cached.hash;
    }
    if (manifest.rev !== undefined && cached.rev !== undefined) {
      return manifest.rev === cached.rev;
    }
    if (manifest.sessionValidated && manifest.hash === undefined && manifest.rev === undefined) {
      return true;
    }
    return false;
  }

  public clear(): void {
    this.manifestByDocId.clear();
  }
}

export function findModelByNormalizedPath<T extends { fileId: string; filePath: string }>(
  models: Iterable<T>,
  targetPath: string,
): T | undefined {
  if (!targetPath) return undefined;
  const cleanTarget = targetPath.replace(/\\/g, '/').replace(/^\.?\//, '').trim().toLowerCase();
  const bareTarget = cleanTarget.split('/').pop() || cleanTarget;
  const cleanTargetNoExt = cleanTarget.replace(/\.(tex|bib|sty|cls)$/i, '');
  const bareTargetNoExt = bareTarget.replace(/\.(tex|bib|sty|cls)$/i, '');

  let bareFallback: T | undefined;

  for (const model of models) {
    const cleanPath = (model.filePath || model.fileId)
      .replace(/\\/g, '/')
      .replace(/^\.?\//, '')
      .trim()
      .toLowerCase();
    const barePath = cleanPath.split('/').pop() || cleanPath;
    const cleanPathNoExt = cleanPath.replace(/\.(tex|bib|sty|cls)$/i, '');
    const barePathNoExt = barePath.replace(/\.(tex|bib|sty|cls)$/i, '');

    if (
      cleanPath === cleanTarget ||
      cleanPath === cleanTargetNoExt ||
      cleanPathNoExt === cleanTargetNoExt ||
      cleanPath.endsWith(`/${cleanTarget}`) ||
      cleanPathNoExt.endsWith(`/${cleanTargetNoExt}`) ||
      cleanTarget.endsWith(`/${cleanPath}`) ||
      cleanTargetNoExt.endsWith(`/${cleanPathNoExt}`)
    ) {
      return model;
    }

    if (
      !bareFallback &&
      !cleanTarget.includes('/') &&
      (barePath === bareTarget || barePathNoExt === bareTargetNoExt)
    ) {
      bareFallback = model;
    }
  }
  return bareFallback;
}

export interface SpillableModelRecord {
  fileId: string;
  content: string;
  filePath: string;
  projectId?: string;
  spaceId?: string;
  pageId?: string;
  yText?: unknown | null;
  isDirty: boolean;
  isAuthoritative?: boolean;
  serverRev?: number;
  hash?: string | null;
  serverUpdatedAt?: string;
  lastActiveAt: number;
}

export function mergeModelRegistration(
  existing: SpillableModelRecord,
  initialData: {
    content: string;
    filePath?: string;
    projectId?: string;
    spaceId?: string;
    pageId?: string;
    yText?: unknown;
    serverRev?: number;
    hash?: string | null;
    serverUpdatedAt?: string;
  },
  incomingAuthoritative: boolean,
  now: number,
): number {
  existing.lastActiveAt = now;
  if (initialData.filePath) existing.filePath = initialData.filePath;
  if (initialData.projectId) existing.projectId = initialData.projectId;
  if (initialData.spaceId) existing.spaceId = initialData.spaceId;
  if (initialData.pageId) existing.pageId = initialData.pageId;
  if (initialData.yText !== undefined) existing.yText = initialData.yText;
  if (
    initialData.serverRev !== undefined &&
    (existing.serverRev === undefined || initialData.serverRev >= existing.serverRev)
  ) {
    existing.serverRev = initialData.serverRev;
  }
  if (initialData.hash !== undefined) existing.hash = initialData.hash;
  if (initialData.serverUpdatedAt !== undefined) {
    existing.serverUpdatedAt = initialData.serverUpdatedAt;
  }
  if (incomingAuthoritative) {
    existing.isAuthoritative = true;
  }
  let bytesDelta = 0;
  if (!existing.isDirty && incomingAuthoritative && initialData.content !== existing.content) {
    bytesDelta = measureUtf8Bytes(initialData.content) - measureUtf8Bytes(existing.content);
    existing.content = initialData.content;
  }
  return bytesDelta;
}

export async function resolveHydratedRegistrationFromSink(
  persistenceSink: IDocumentSpillSink,
  manifest: DocumentManifestEntry | undefined,
  fileId: string,
  filePath?: string,
  projectId?: string,
): Promise<{
  isDirty: boolean;
  data: {
    content: string;
    filePath?: string;
    projectId?: string;
    serverRev?: number;
    hash?: string | null;
    isAuthoritative: boolean;
  };
} | null> {
  try {
    const [unsyncedEdit, syncedDoc] = await Promise.all([
      persistenceSink.getUnsyncedEdit(fileId).catch(() => null),
      persistenceSink.getSyncedDoc
        ? persistenceSink.getSyncedDoc(fileId).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (
      unsyncedEdit &&
      typeof unsyncedEdit.content === 'string' &&
      (!syncedDoc || (unsyncedEdit.savedAt ?? Infinity) >= (syncedDoc.updatedAt ?? 0))
    ) {
      return {
        isDirty: true,
        data: {
          content: unsyncedEdit.content,
          filePath:
            filePath || unsyncedEdit.title || syncedDoc?.filePath || syncedDoc?.title || fileId,
          projectId: projectId || unsyncedEdit.projectId || syncedDoc?.projectId,
          serverRev: unsyncedEdit.expectedRev ?? syncedDoc?.rev ?? manifest?.rev,
          hash: syncedDoc?.hash ?? manifest?.hash,
          isAuthoritative: true,
        },
      };
    }

    if (syncedDoc && typeof syncedDoc.content === 'string') {
      return {
        isDirty: false,
        data: {
          content: syncedDoc.content,
          filePath: filePath || syncedDoc.filePath || syncedDoc.title || fileId,
          projectId: projectId || syncedDoc.projectId,
          serverRev: syncedDoc.rev ?? manifest?.rev,
          hash: syncedDoc.hash ?? manifest?.hash,
          isAuthoritative: true,
        },
      };
    }
  } catch {
    // Fallback to caller's default registration
  }
  return null;
}

export function rewriteModelsFolderPrefix<
  T extends { fileId: string; filePath: string; content: string; lastActiveAt: number },
>(
  models: Iterable<T>,
  oldPrefix: string,
  newPrefix: string,
): Array<{ fileId: string; oldPath: string; newPath: string; content: string }> {
  const cleanOld = normalizeVirtualPath(oldPrefix);
  const cleanNew = normalizeVirtualPath(newPrefix);
  if (!cleanOld || cleanOld === cleanNew) return [];

  const updated: Array<{ fileId: string; oldPath: string; newPath: string; content: string }> = [];
  const now = Date.now();

  for (const model of models) {
    const nextPath = rewritePathPrefix(model.filePath, cleanOld, cleanNew, true);
    if (nextPath !== null) {
      const prevPath = model.filePath;
      model.filePath = nextPath;
      model.lastActiveAt = now;
      updated.push({
        fileId: model.fileId,
        oldPath: prevPath,
        newPath: nextPath,
        content: model.content,
      });
    }
  }
  return updated;
}

export function persistEvictedModelToSink(
  persistenceSink: IDocumentSpillSink,
  fileId: string,
  model: SpillableModelRecord,
  dirtyFileIds: Set<string>,
): void {
  if (model.isDirty) {
    dirtyFileIds.add(fileId);
    const savePromise =
      model.serverRev !== undefined
        ? persistenceSink.saveUnsyncedEdit(
            fileId,
            model.content,
            model.projectId || 'workspace-local',
            model.filePath,
            model.serverRev,
          )
        : persistenceSink.saveUnsyncedEdit(
            fileId,
            model.content,
            model.projectId || 'workspace-local',
            model.filePath,
          );
    savePromise.catch(() => {});
  } else {
    dirtyFileIds.delete(fileId);
    if (
      model.isAuthoritative !== false &&
      (model.content.length > 0 || model.serverRev !== undefined || model.hash !== undefined) &&
      persistenceSink.putSyncedDoc
    ) {
      persistenceSink
        .putSyncedDoc({
          id: fileId,
          projectId: model.projectId || 'workspace-local',
          title: model.filePath,
          content: model.content,
          filePath: model.filePath,
          rev: model.serverRev,
          hash: model.hash,
          updatedAt: Date.now(),
        })
        .catch(() => {});
    }
  }
}
