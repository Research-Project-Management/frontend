/**
 * latex-visual-floats.cache.ts
 *
 * Asset path resolution and bounded Blob ObjectURL cache for Visual Mode figure previews.
 */

import { workspaceCoordinator } from '@/features/editor/core/coordinator/workspace.coordinator';
import type { WorkspaceProjectItem } from '@/features/editor/core/coordinator/workspace-file-index';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { filestore } from '@/features/editor/sdk/pages/filestore.client';
import { fetchAuthorized, resolveFileUrl } from '@/shared/lib/file-client';
import { memoryGovernor } from '@/shared/lib/memory-governor';

const PREVIEWABLE_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const MAX_CACHED_IMAGE_BLOBS = memoryGovernor.getBudget().maxVisualFigureBlobs;
const figureBlobUrlCache = new Map<string, string>();
const pendingBlobRequests = new Map<string, Promise<string | null>>();

export function getVisualFigureBlobCacheSize(): number {
  return figureBlobUrlCache.size;
}

export function getCachedFigureBlobUrl(resolvedUrl: string): string | undefined {
  return figureBlobUrlCache.get(resolvedUrl);
}

/**
 * Deterministically revokes all cached figure Blob ObjectURLs and clears in-flight requests
 * so switching projects or logging out reclaims native browser blob memory immediately.
 */
export function clearVisualFigureBlobCache(): void {
  pendingBlobRequests.clear();
  for (const blobUrl of figureBlobUrlCache.values()) {
    if (blobUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // Ignore revocation errors
      }
    }
  }
  figureBlobUrlCache.clear();
}

function normalizeLatexAssetPath(raw: string): string {
  return raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/)+/, '')
    .replace(/^\/+/, '')
    .toLowerCase();
}

function stripFileExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  const lastSlash = path.lastIndexOf('/');
  return lastDot > lastSlash ? path.slice(0, lastDot) : path;
}

function getBaseName(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}

export function resolveProjectImageAssetUrl(latexPath: string): string | null {
  const normQuery = normalizeLatexAssetPath(latexPath);
  if (!normQuery) return null;

  try {
    const pageState =
      typeof usePageStore?.getState === 'function' ? usePageStore.getState() : null;
    const projectFiles =
      (workspaceCoordinator?.getProjectFiles?.() as WorkspaceProjectItem[] | undefined) ?? [];
    if (!pageState || projectFiles.length === 0) return null;

    const queryStem = stripFileExtension(normQuery);
    const queryBase = getBaseName(normQuery);
    const queryBaseStem = stripFileExtension(queryBase);

    let bestItem: WorkspaceProjectItem | null = null;
    let bestScore = 0;

    for (const item of projectFiles) {
      if (item.isFolder) continue;
      const candidates = [item.path, item.name, item.title].filter(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
      );
      for (const cand of candidates) {
        const normCand = normalizeLatexAssetPath(cand);
        const dotIdx = normCand.lastIndexOf('.');
        const slashIdx = normCand.lastIndexOf('/');
        if (dotIdx <= slashIdx) continue;
        const ext = normCand.slice(dotIdx + 1);
        if (!PREVIEWABLE_IMAGE_EXTS.has(ext)) continue;

        const candStem = stripFileExtension(normCand);
        const candBase = getBaseName(normCand);
        const candBaseStem = stripFileExtension(candBase);

        let score = 0;
        if (normCand === normQuery) score = 4;
        else if (candStem === queryStem) score = 3;
        else if (candBase === queryBase) score = 2;
        else if (candBaseStem === queryBaseStem) score = 1;

        if (score > bestScore) {
          bestScore = score;
          bestItem = item;
          if (score === 4) break;
        }
      }
      if (bestScore === 4) break;
    }

    if (!bestItem) return null;

    const projectOrSpaceId =
      bestItem.projectId ||
      pageState.spaceId ||
      pageState.projectId ||
      pageState.rootPageId ||
      pageState.parentPageId ||
      '';
    const fileId = bestItem.fileId || bestItem.id;
    if (!projectOrSpaceId || !fileId) return null;

    const pageId =
      bestItem.pageId || pageState.rootPageId || pageState.parentPageId || undefined;
    const streamUrl = filestore.getStreamUrl(projectOrSpaceId, fileId, pageId);
    return resolveFileUrl(streamUrl) || null;
  } catch {
    return null;
  }
}

export async function loadAuthorizedImageBlobUrl(resolvedUrl: string): Promise<string | null> {
  const cached = figureBlobUrlCache.get(resolvedUrl);
  if (cached) return cached;

  const inflight = pendingBlobRequests.get(resolvedUrl);
  if (inflight) return inflight;

  const promise = (async (): Promise<string | null> => {
    try {
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return null;
      }
      const res = await fetchAuthorized(resolvedUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (figureBlobUrlCache.size >= MAX_CACHED_IMAGE_BLOBS) {
        const oldestKey = figureBlobUrlCache.keys().next().value;
        if (oldestKey) {
          const oldestUrl = figureBlobUrlCache.get(oldestKey);
          figureBlobUrlCache.delete(oldestKey);
          if (oldestUrl && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(oldestUrl);
          }
        }
      }
      figureBlobUrlCache.set(resolvedUrl, blobUrl);
      return blobUrl;
    } catch {
      return null;
    } finally {
      pendingBlobRequests.delete(resolvedUrl);
    }
  })();

  pendingBlobRequests.set(resolvedUrl, promise);
  return promise;
}
