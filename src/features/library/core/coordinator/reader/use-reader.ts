'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { multiTabBus } from '@/shared/lib/multi-tab';
import { memoryGovernor } from '@/shared/lib/memory-governor';
import { getErrorMessage } from '@/shared/lib/utils';
import { logger } from '@/shared/lib/logger';
import {
  copyToClipboard,
  triggerBrowserTextDownload,
} from '@/features/library/core/coordinator/citation-export.coordinator';
import { getItemFileUrl, isProjectScope } from '@/features/library/domain/identifiers';
import {
  fetchReaderDocumentBlob,
  prefetchReaderDocumentBlob,
  invalidateReaderDocumentBlob,
  useReaderBootstrap,
  useReaderItem,
  useReaderFulltext,
  useAnnotations,
  useExportAnnotatedPdf,
  READER_TOAST_IDS,
} from '@/features/library/sdk/queries/reader.queries';
import { registerReaderResourceCleanupHandler } from '@/features/library/sdk/queries/cache-patcher.queries';
import {
  LruTabPool,
  calculateAdaptiveTabPoolCapacity,
  warmViewerPool,
} from '@/features/library/domain/reader/tab-pool';
import { normalizeSpaceId } from '@/features/library/sdk/query-keys';
import { useReadingProgress } from './use-reader-tabs';
import { useAnnotationBatch } from './use-annotation-batch';
import { useReaderStore } from '@/features/library/core/store/reader.store';
import { useLibraryUIStore } from '@/features/library/core/store/ui.store';
import { useWorkspaceContextStore } from '@/features/shell/store/workspace-context.store';
import type {
  ReaderDocument,
  ReaderAnnotation,
  AnnotationRect,
  ReaderNavigationTarget,
  AnnotationType,
} from '@/features/library/types/reader.types';
import {
  DEFAULT_ANNOTATION_COLOR,
  formatAnnotationCitation,
} from '@/features/library/domain/reader/reader';

export { useExportAnnotatedPdf, prefetchReaderDocumentBlob };

export function useReaderClipboard(resetDelay = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string | null | undefined, label?: string): Promise<boolean> => {
      const clean = text?.trim();
      if (!clean) {
        toast.error('Nothing to copy', { id: READER_TOAST_IDS.clipboard });
        return false;
      }

      try {
        const ok = await copyToClipboard(clean);
        if (!ok) throw new Error('Copy failed');

        const successMessage = label ? `Copied ${label}` : 'Copied';
        toast.success(successMessage, { id: READER_TOAST_IDS.clipboard });

        const activeKey = label || 'copied';
        setCopiedKey(activeKey);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setCopiedKey(null);
        }, resetDelay);

        return true;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Copy failed';
        toast.error(errorMsg, { id: READER_TOAST_IDS.clipboard });
        return false;
      }
    },
    [resetDelay],
  );

  return {
    copy,
    copiedKey,
    isCopied: (key?: string) => (key ? copiedKey === key : Boolean(copiedKey)),
  };
}

export function useReaderFileDownload() {
  const download = useCallback(
    (filename: string, content: string | null | undefined, mimeType = 'text/plain;charset=utf-8') => {
      if (!content || !content.trim()) {
        toast.error('Nothing to download', { id: READER_TOAST_IDS.download });
        return false;
      }

      try {
        triggerBrowserTextDownload(content, filename, mimeType);
        return true;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Download failed';
        toast.error(errorMsg, { id: READER_TOAST_IDS.download });
        return false;
      }
    },
    [],
  );

  return { download };
}

interface UsePdfReturn {
  blobUrl: string | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

export function useReaderDocumentBlobLoader() {
  return useCallback(
    (
      url: string,
      signal?: AbortSignal,
      options?: { spaceId?: string; allowHtml?: boolean },
    ) => fetchReaderDocumentBlob(url, signal, options),
    [],
  );
}

const warmObjectUrlPool = new LruTabPool<{ url: string; objectUrl: string }>(
  calculateAdaptiveTabPoolCapacity(),
);

function buildWarmObjectUrlKey(url: string, spaceId?: string): string {
  return `${spaceId || 'global'}::${url}`;
}

export function evictWarmObjectUrl(url?: string | null, spaceId?: string): void {
  if (!url) return;
  const key = buildWarmObjectUrlKey(url, spaceId);
  const existing = warmObjectUrlPool.peek(key);
  if (existing) {
    URL.revokeObjectURL(existing.objectUrl);
    warmObjectUrlPool.delete(key);
    for (const item of warmViewerPool.getValuesMruOrder()) {
      if (item.blobUrl === existing.objectUrl || item.fileUrl === url) {
        warmViewerPool.delete(item.paperId);
      }
    }
  }
}

export function cleanupReaderResourcesForItems(
  itemIds: Iterable<string>,
  options?: { spaceId?: string; candidateUrls?: Iterable<string | null | undefined> },
): void {
  const spaceId = options?.spaceId;
  const readerStore = useReaderStore.getState();
  const urlsToInvalidate = new Set<string>();

  if (options?.candidateUrls) {
    for (const u of options.candidateUrls) {
      if (u && typeof u === 'string') urlsToInvalidate.add(u);
    }
  }

  for (const id of itemIds) {
    if (!id || id === 'library') continue;
    const openTab = readerStore.tabs.find((t) => t.id === id);
    if (openTab?.fileUrl) urlsToInvalidate.add(openTab.fileUrl);
    const warmEntry = warmViewerPool.peek(id);
    if (warmEntry?.fileUrl) urlsToInvalidate.add(warmEntry.fileUrl);
    warmViewerPool.delete(id);
    if (openTab) readerStore.closeTab(id);
  }

  for (const url of urlsToInvalidate) {
    evictWarmObjectUrl(url, spaceId);
    evictWarmObjectUrl(url, undefined);
    void invalidateReaderDocumentBlob(url, { spaceId });
  }
}

export const READER_IDLE_RAM_EVICT_MS = 5 * 60 * 1000;

let activeReaderMountCount = 0;
let idleRamEvictTimer: ReturnType<typeof setTimeout> | null = null;

function cancelIdleRamEvictTimer(): void {
  if (idleRamEvictTimer !== null) {
    clearTimeout(idleRamEvictTimer);
    idleRamEvictTimer = null;
  }
}

/**
 * Marks a Reader view as mounted and cancels any pending idle RAM eviction.
 */
export function markReaderMounted(): void {
  activeReaderMountCount += 1;
  cancelIdleRamEvictTimer();
  memoryGovernor.setActiveDomain('reader');
}

/**
 * Marks a Reader view as unmounted. When no Reader view remains mounted,
 * schedules automatic revocation of in-memory ObjectURL blobs after 5 minutes
 * (tab list in localStorage and OPFS/IndexedDB disk cache remain intact).
 */
export function markReaderUnmounted(): void {
  activeReaderMountCount = Math.max(0, activeReaderMountCount - 1);
  if (activeReaderMountCount === 0 && typeof window !== 'undefined') {
    if (memoryGovernor.getActiveDomain() === 'reader') {
      memoryGovernor.setActiveDomain('workspace');
    }
    cancelIdleRamEvictTimer();
    idleRamEvictTimer = setTimeout(() => {
      idleRamEvictTimer = null;
      if (activeReaderMountCount === 0) {
        clearAllWarmReaderPools();
      }
    }, READER_IDLE_RAM_EVICT_MS);
  }
}

/**
 * Revokes all in-memory ObjectURL blobs across `warmObjectUrlPool` and `warmViewerPool`
 * (e.g., on cross-tab logout, session expiration, or extended Reader idle).
 */
export function clearAllWarmReaderPools(): void {
  cancelIdleRamEvictTimer();
  for (const entry of warmObjectUrlPool.getValuesMruOrder()) {
    try {
      URL.revokeObjectURL(entry.objectUrl);
    } catch {
      // ignore
    }
  }
  warmObjectUrlPool.clear();
  warmViewerPool.clear();
}

/**
 * Hibernates non-active warm ObjectURLs when a browser tab remains in the background
 * for an extended period (3 minutes), reclaiming RAM across multi-tab sessions while keeping
 * the active paper instant.
 */
export function hibernateInactiveWarmReaderPools(): number {
  const activeTabId = useReaderStore.getState().activeTabId;
  const activeTab = useReaderStore.getState().tabs.find((t) => t.id === activeTabId);
  const activeUrl = activeTab?.fileUrl;
  let evictedCount = 0;

  for (const item of warmViewerPool.getValuesMruOrder()) {
    if (item.paperId !== activeTabId) {
      warmViewerPool.delete(item.paperId);
      evictedCount += 1;
    }
  }

  for (const key of warmObjectUrlPool.getKeysMruOrder()) {
    const entry = warmObjectUrlPool.peek(key);
    if (entry && (!activeUrl || entry.url !== activeUrl)) {
      try {
        URL.revokeObjectURL(entry.objectUrl);
      } catch {
        // ignore
      }
      warmObjectUrlPool.delete(key);
      evictedCount += 1;
    }
  }

  return evictedCount;
}

if (typeof window !== 'undefined') {
  memoryGovernor.register({
    id: 'library-reader-warm-pools',
    domain: 'reader',
    priority: 30,
    reclaim: ({ level }) => {
      if (level === 'logout') {
        const count = warmObjectUrlPool.size + warmViewerPool.size;
        clearAllWarmReaderPools();
        return count;
      }
      if (level === 'route-handover' && activeReaderMountCount === 0) {
        const count = warmObjectUrlPool.size + warmViewerPool.size;
        clearAllWarmReaderPools();
        return count;
      }
      if (level === 'tab-hidden' || level === 'pressure' || level === 'route-handover') {
        return hibernateInactiveWarmReaderPools();
      }
      return 0;
    },
    getStats: () => ({
      id: 'library-reader-warm-pools',
      domain: 'reader',
      entryCount: warmObjectUrlPool.size + warmViewerPool.size,
      details: {
        warmObjectUrls: warmObjectUrlPool.size,
        warmViewerTabs: warmViewerPool.size,
        activeMountCount: activeReaderMountCount,
      },
    }),
  });
}

registerReaderResourceCleanupHandler(cleanupReaderResourcesForItems);

export function usePdf(url: string | null, spaceId?: string): UsePdfReturn {
  const [blobUrl, setBlobUrl] = useState<string | null>(() => {
    if (!url) return null;
    const direct = warmObjectUrlPool.peek(buildWarmObjectUrlKey(url, spaceId));
    if (direct) return direct.objectUrl;
    if (spaceId && spaceId !== 'user') {
      return warmObjectUrlPool.peek(buildWarmObjectUrlKey(url, 'user'))?.objectUrl ?? null;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!url) {
      setBlobUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const poolKey = buildWarmObjectUrlKey(url, spaceId);

    if (retryCount === 0) {
      const warmHit =
        warmObjectUrlPool.get(poolKey) ||
        (spaceId && spaceId !== 'user'
          ? warmObjectUrlPool.get(buildWarmObjectUrlKey(url, 'user'))
          : undefined);
      if (warmHit) {
        warmObjectUrlPool.put(poolKey, warmHit);
        setBlobUrl(warmHit.objectUrl);
        setIsLoading(false);
        setError(null);
        return;
      }
    } else {
      evictWarmObjectUrl(url, spaceId);
      void invalidateReaderDocumentBlob(url, { spaceId });
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let active = true;

    async function loadPdf() {
      try {
        setIsLoading(true);
        setError(null);
        setBlobUrl(null);

        const blob = await fetchReaderDocumentBlob(
          url!,
          controller.signal,
          { spaceId, forceRefresh: retryCount > 0 },
        );

        if (active) {
          const newObjectUrl = URL.createObjectURL(blob);
          const keysBefore = warmObjectUrlPool.getKeysMruOrder();
          const objectUrlsBefore = new Map<string, string>();
          for (const k of keysBefore) {
            const v = warmObjectUrlPool.peek(k);
            if (v) objectUrlsBefore.set(k, v.objectUrl);
          }

          const evictedKey = warmObjectUrlPool.put(
            poolKey,
            { url: url!, objectUrl: newObjectUrl },
            new Set([poolKey]),
          );
          if (evictedKey) {
            const evictedObjectUrl = objectUrlsBefore.get(evictedKey);
            if (evictedObjectUrl && evictedObjectUrl !== newObjectUrl) {
              URL.revokeObjectURL(evictedObjectUrl);
              for (const item of warmViewerPool.getValuesMruOrder()) {
                if (item.blobUrl === evictedObjectUrl) {
                  warmViewerPool.delete(item.paperId);
                }
              }
            }
          }
          setBlobUrl(newObjectUrl);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        if (active) {
          logger.error('[usePdf] PDF load error', err);
          setError(getErrorMessage(err) || 'Unable to load PDF document.');
          setBlobUrl(null);
          setIsLoading(false);
        }
      }
    }

    void loadPdf();

    return () => {
      active = false;
      controller.abort();
    };
  }, [url, retryCount, spaceId]);

  return { blobUrl, isLoading, error, retry };
}

export function useReader(overridePaperId?: string | null, onBackOverride?: () => void) {
  const params = useParams() as { paperId?: string; projectId?: string };
  const router = useRouter();
  const activeSpace = useWorkspaceContextStore((s) => s.activeSpace);
  const searchParams = useSearchParams();
  const queryProjectId = searchParams?.get('projectId') || undefined;
  const isProject =
    (activeSpace.type === 'project' && Boolean(activeSpace.projectId)) ||
    Boolean(params?.projectId) ||
    Boolean(queryProjectId);
  const rawProjectId =
    (params?.projectId as string) ||
    queryProjectId ||
    (activeSpace.type === 'project' ? activeSpace.projectId : undefined);
  const projectId = rawProjectId || 'user';
  const spaceId = normalizeSpaceId(projectId);

  const storeReadingId = useReaderStore((s) => s.readingPaperId);
  const closeReader = useReaderStore((s) => s.closeReader);
  const setActiveTab = useReaderStore((s) => s.setActiveTab);
  const effectivePaperId = overridePaperId || params?.paperId || storeReadingId || '';

  const requestedAttachmentId = searchParams?.get('attachmentId') || undefined;
  const activeTabAttachmentId = useReaderStore(
    (s) => s.tabs.find((t) => t.id === effectivePaperId)?.attachmentId,
  );
  const resolvedRequestedAttachmentId = requestedAttachmentId || activeTabAttachmentId || undefined;

  useReaderBootstrap(spaceId, effectivePaperId, resolvedRequestedAttachmentId);

  const paperQuery = useReaderItem(spaceId, effectivePaperId);
  const paper = (paperQuery.data ?? null) as ReaderDocument | null;
  const isLoadingPapers = paperQuery.isLoading;

  const effectiveSpaceId = useMemo(() => {
    if (isProjectScope(spaceId)) return spaceId;
    if (paper?.projectId && isProjectScope(String(paper.projectId))) {
      return String(paper.projectId);
    }
    return spaceId;
  }, [spaceId, paper?.projectId]);

  const fulltextQuery = useReaderFulltext(effectiveSpaceId, effectivePaperId);
  const fulltext = fulltextQuery.data ?? null;
  const isLoadingFulltext = fulltextQuery.isLoading;

  const selectedAttachment = useMemo(() => {
    if (!paper?.attachments || paper.attachments.length === 0) return null;
    if (resolvedRequestedAttachmentId) {
      const found = paper.attachments.find((a) => a.id === resolvedRequestedAttachmentId);
      if (found) return found;
    }
    return (
      paper.attachments.find((a) => a.attachmentType === 'primary_pdf') ||
      paper.attachments[0] ||
      null
    );
  }, [paper?.attachments, resolvedRequestedAttachmentId]);

  const effectiveAttachmentId = selectedAttachment?.id;

  const paperUrl = useMemo(() => {
    if (selectedAttachment) {
      const downloadUrl =
        (selectedAttachment as { fileUrl?: string; url?: string }).fileUrl ||
        selectedAttachment.url;
      if (downloadUrl) return downloadUrl;
    }
    return getItemFileUrl(paper, effectiveSpaceId);
  }, [selectedAttachment, paper, effectiveSpaceId]);

  const {
    blobUrl: pdfBlobUrl,
    isLoading: pdfLoading,
    error: pdfError,
    retry: handleRetryPdf,
  } = usePdf(paperUrl || null, effectiveSpaceId);

  const [pendingNoteText, setPendingNoteText] = useState('');
  const [bibtexOpen, setBibtexOpen] = useState(false);
  const [targetPage, setTargetPage] = useState<ReaderNavigationTarget | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [visiblePage, setVisiblePage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [zoom, setZoom] = useState(1.0);

  const {
    annotations = [],
    isLoading: isLoadingAnnotations,
    isError: isAnnotationsError,
    refetch: refetchAnnotations,
    createAnnotation,
    updateAnnotation: rawUpdateAnnotation,
    deleteAnnotation: rawDeleteAnnotation,
    extractNotes,
    importExternal,
    isUpdating: isUpdatingAnnotation,
    isDeleting: isDeletingAnnotation,
    isExtracting: isExtractingNotes,
    isImporting: isImportingAnnotations,
  } = useAnnotations(effectiveSpaceId, effectiveAttachmentId);

  const annotationsRef = useRef<ReaderAnnotation[]>(annotations);
  annotationsRef.current = annotations;

  useReadingProgress({
    spaceId: effectiveSpaceId,
    paper,
    effectivePaperId,
    effectiveAttachmentId,
    visiblePage,
    setVisiblePage,
    setTargetPage,
  });

  const {
    selectedAnnotationIds,
    setSelectedAnnotationIds,
    isBatchProcessing,
    handleToggleSelectAnnotation,
    handleBatchChangeColor,
    handleBatchDelete,
    handleBatchAddToNote,
    pruneDeletedFromHistory,
    recordCreateAnnotation,
    recordUpdateAnnotation,
    recordSingleDeleteAnnotation,
    recordDeletedAnnotations,
    undo: handleUndoAnnotation,
    redo: handleRedoAnnotation,
    canUndo,
    canRedo,
  } = useAnnotationBatch({
    spaceId: effectiveSpaceId,
    effectiveAttachmentId,
    paper,
    extractNotes,
  });

  const updateAnnotation = useCallback(
    async (
      annotationId: string,
      expectedVersion: number | undefined,
      dto: {
        type?: AnnotationType;
        color?: string;
        comment?: string;
        quoteText?: string;
        pageLabel?: string | null;
        tags?: string[];
        rects?: AnnotationRect[];
        boundingRect?: AnnotationRect;
      },
    ) => {
      const target = (annotationsRef.current || []).find((a) => a.id === annotationId);
      const before: Partial<ReaderAnnotation> = target
        ? {
            ...(dto.type !== undefined ? { type: target.type } : {}),
            ...(dto.color !== undefined ? { color: target.color } : {}),
            ...(dto.comment !== undefined ? { comment: target.comment ?? '' } : {}),
            ...(dto.quoteText !== undefined ? { quoteText: target.quoteText } : {}),
            ...(dto.pageLabel !== undefined ? { pageLabel: target.pageLabel ?? null } : {}),
            ...(dto.tags !== undefined ? { tags: target.tags ?? [] } : {}),
            ...(dto.rects !== undefined ? { rects: target.rects } : {}),
            ...(dto.boundingRect !== undefined ? { boundingRect: target.boundingRect } : {}),
          }
        : {};
      const res = await rawUpdateAnnotation(annotationId, expectedVersion, dto);
      if (target && effectiveAttachmentId) {
        recordUpdateAnnotation({
          annotationId,
          attachmentId: effectiveAttachmentId,
          before,
          after: dto,
          version: (res as { version?: number } | undefined)?.version ?? target.version,
        });
      }
      return res;
    },
    [effectiveAttachmentId, rawUpdateAnnotation, recordUpdateAnnotation],
  );

  const deleteAnnotation = useCallback(
    async (annotationId: string, expectedVersion?: number) => {
      const target = (annotationsRef.current || []).find((a) => a.id === annotationId);
      const res = await rawDeleteAnnotation(annotationId, expectedVersion);
      pruneDeletedFromHistory([annotationId]);
      if (target) recordSingleDeleteAnnotation(target);
      return res;
    },
    [recordSingleDeleteAnnotation, rawDeleteAnnotation, pruneDeletedFromHistory],
  );

  useEffect(() => {
    setBibtexOpen(false);
  }, [paper?.id]);

  const handleNavigateToAnnotation = useCallback(
    (pageNumber: number, annotationId?: string, coords?: AnnotationRect, yRatio?: number) => {
      if (pageNumber >= 1) {
        setTargetPage({ pageNumber, annotationId, coords, yRatio, timestamp: Date.now() });
      }
    },
    [],
  );

  const handleNavigateToPage = useCallback(
    (pageNumber: number) => {
      handleNavigateToAnnotation(pageNumber);
    },
    [handleNavigateToAnnotation],
  );

  const handleAddToNote = useCallback(
    (text: string, pageNumber?: number, annotationId?: string) => {
      const targetAnn = annotationId
        ? (annotationsRef.current || []).find((a) => a.id === annotationId)
        : undefined;
      const trimmed = (
        text ||
        targetAnn?.quoteText ||
        targetAnn?.text ||
        targetAnn?.comment ||
        ''
      ).trim();

      const resolvedPage =
        pageNumber ??
        targetAnn?.pageNumber ??
        (targetAnn?.pageIndex !== undefined ? targetAnn.pageIndex + 1 : undefined);

      let citationLink = '';
      if (resolvedPage || annotationId) {
        const cit = formatAnnotationCitation(
          paper,
          effectiveAttachmentId,
          resolvedPage,
          annotationId,
          effectiveSpaceId,
          targetAnn?.pageLabel,
        );
        citationLink = trimmed ? ` ${cit.markdown}` : cit.markdown;
      }

      const commentLine =
        targetAnn?.comment && targetAnn.comment.trim() && targetAnn.comment.trim() !== trimmed
          ? `\n**Note:** ${targetAnn.comment.trim()}`
          : '';
      const quotedText = trimmed.replace(/\r?\n/g, '\n> ');
      const formatted = trimmed
        ? `> "${quotedText}"${citationLink}${commentLine}`
        : `${citationLink}${commentLine}`;

      if (!formatted.trim()) return;

      setPendingNoteText(formatted);
      useLibraryUIStore.getState().setIsInspectorOpen(true);
      useLibraryUIStore.getState().setActiveInspectorTab('notes');
    },
    [paper, effectiveAttachmentId, effectiveSpaceId],
  );

  const handleAnnotate = useCallback(
    async (
      text: string,
      pageNum?: number,
      colorHex: string = DEFAULT_ANNOTATION_COLOR,
      rects?: AnnotationRect[],
      type: 'highlight' | 'underline' | 'note' | 'text' | 'rect' | 'area' | 'ink' = 'highlight',
      comment?: string,
      pageLabel?: string | null,
    ) => {
      if (!effectiveAttachmentId) return;
      const quote = text?.trim();
      if (
        !quote &&
        type !== 'rect' &&
        type !== 'area' &&
        type !== 'text' &&
        type !== 'note' &&
        type !== 'ink'
      ) {
        return;
      }

      try {
        const pageIndex = pageNum !== undefined && pageNum > 0 ? pageNum - 1 : 0;
        const effectiveType = type === 'area' ? 'rect' : type;
        const created = await createAnnotation({
          type: effectiveType as AnnotationType,
          pageIndex,
          pageLabel: pageLabel ?? undefined,
          color: colorHex,
          quoteText: quote || undefined,
          comment: comment?.trim() || undefined,
          rects,
          tags: [],
        });
        if (created && typeof created === 'object' && 'id' in created) {
          recordCreateAnnotation(created as ReaderAnnotation, effectiveAttachmentId);
        }
        return created;
      } catch {
        // Error toast is handled centrally by createMutation.onError
      }
    },
    [effectiveAttachmentId, createAnnotation, recordCreateAnnotation],
  );

  const goBack = useCallback(() => {
    if (onBackOverride) {
      onBackOverride();
      return;
    }
    setActiveTab('library');
    router.push(isProject && rawProjectId ? `/projects/${rawProjectId}/library` : '/library');
  }, [onBackOverride, setActiveTab, router, isProject, rawProjectId]);

  const state = useMemo(
    () => ({
      spaceId: effectiveSpaceId,
      projectId: isProject ? rawProjectId : undefined,
      isProject,
      rawProjectId,
      paperId: effectivePaperId,
      isLoadingPapers,
      paper,
      paperUrl,
      pdfBlobUrl,
      pdfLoading,
      pdfError,
      pendingNoteText,
      bibtexOpen,
      fulltext,
      isLoadingFulltext,
      targetPage,
      isSidebarOpen,
      visiblePage,
      numPages,
      zoom,
      selectedAnnotationIds,
      isBatchProcessing,
      annotations: annotations || [],
      isLoadingAnnotations,
      isAnnotationsError,
      isUpdatingAnnotation,
      isDeletingAnnotation,
      isExtractingNotes,
      isImportingAnnotations,
      effectiveAttachmentId,
      selectedAttachment,
      canUndo,
      canRedo,
    }),
    [
      effectiveSpaceId, isProject, rawProjectId, effectivePaperId, isLoadingPapers,
      paper, paperUrl, pdfBlobUrl, pdfLoading, pdfError, pendingNoteText, bibtexOpen,
      fulltext, isLoadingFulltext, targetPage, isSidebarOpen, visiblePage, numPages,
      zoom, selectedAnnotationIds, isBatchProcessing, annotations, isLoadingAnnotations,
      isAnnotationsError, isUpdatingAnnotation, isDeletingAnnotation, isExtractingNotes,
      isImportingAnnotations, effectiveAttachmentId, selectedAttachment, canUndo, canRedo,
    ],
  );

  const actions = useMemo(
    () => ({
      setBibtexOpen,
      handleAddToNote,
      handleAnnotate,
      handleNavigateToPage,
      handleNavigateToAnnotation,
      setPendingNoteText,
      handleRetryPdf,
      navigate: router.push,
      goBack,
      closeReader,
      setIsSidebarOpen,
      setVisiblePage,
      setNumPages,
      setZoom,
      setSelectedAnnotationIds,
      handleToggleSelectAnnotation,
      handleBatchChangeColor,
      handleBatchDelete,
      handleBatchAddToNote,
      handleUndoAnnotation,
      handleRedoAnnotation,
      recordCreateAnnotation,
      recordUpdateAnnotation,
      recordSingleDeleteAnnotation,
      recordDeletedAnnotations,
      updateAnnotation,
      deleteAnnotation,
      extractNotes,
      importExternal,
      refetchAnnotations,
    }),
    [
      handleAddToNote, handleAnnotate, handleNavigateToPage, handleNavigateToAnnotation,
      handleRetryPdf, router.push, goBack, closeReader, setSelectedAnnotationIds,
      handleToggleSelectAnnotation, handleBatchChangeColor, handleBatchDelete,
      handleBatchAddToNote, handleUndoAnnotation, handleRedoAnnotation,
      recordCreateAnnotation, recordUpdateAnnotation, recordSingleDeleteAnnotation,
      recordDeletedAnnotations, updateAnnotation, deleteAnnotation, extractNotes,
      importExternal, refetchAnnotations,
    ],
  );

  return useMemo(() => ({ state, actions }), [state, actions]);
}
