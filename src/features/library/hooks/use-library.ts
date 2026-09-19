'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { uploadLibraryFile } from '../services/upload.service';
import { useItems, itemKeys } from './use-items';
import {
  formatCslCitation,
} from '../services/citation.service';
import { IngestionService } from '../services/ingestion.service';
import { useIngestProgress } from './use-ingest-progress';
import { useUnifiedIngest } from './use-ingestion';
import { useCollections } from './use-collections';
import { useSavedSearchResults } from './use-saved-searches';
import { useAsyncJobStatus } from './use-ingestion';
import { useLibrarySidebarStore } from '../store/sidebar.store';
import {
  getDescendantIds,
  sortFilterItems,
  LibraryFilterEngine,
} from '../utils/filter.util';
import type {
  Item,
  Paper,
  CollectionInput,
  CslStyle,
  AddLinkData,
  ItemQueryParams,
} from '../types/library.types';

// ── Canonical Library Query Keys ──────────────────────────────────────────────
export const libraryKeys = {
  all: ['library'] as const,

  items: (scopeId: string) => [...libraryKeys.all, 'items', scopeId] as const,
  itemList: (scopeId: string, filter?: ItemQueryParams) =>
    [...libraryKeys.items(scopeId), 'list', filter] as const,
  itemDetail: (scopeId: string, itemId: string) =>
    [...libraryKeys.items(scopeId), 'detail', itemId] as const,
  itemBundle: (scopeId: string, itemId: string) =>
    [...libraryKeys.items(scopeId), 'bundle', itemId] as const,

  // Aliases kept for backward compat with useLinkPapers / useMergePapers consumers
  papers: (scopeId: string) => [...libraryKeys.all, 'items', scopeId] as const,
  paperBundle: (scopeId: string, itemId: string) =>
    [...libraryKeys.items(scopeId), 'bundle', itemId] as const,

  collections: (scopeId: string) =>
    [...libraryKeys.all, 'collections', scopeId] as const,

  citations: (scopeId: string) =>
    [...libraryKeys.all, 'citations', scopeId] as const,
  citationItem: (scopeId: string, itemId: string, style: CslStyle, index: number = 1) =>
    [...libraryKeys.citations(scopeId), itemId, style, index] as const,

  annotations: (scopeId: string, itemId: string) =>
    [...libraryKeys.all, 'annotations', scopeId, itemId] as const,

  relations: (scopeId: string, itemId: string) =>
    [...libraryKeys.all, 'relations', scopeId, itemId] as const,

  duplicates: (scopeId: string) =>
    [...libraryKeys.all, 'duplicates', scopeId] as const,
  integrity: (scopeId: string) =>
    [...libraryKeys.all, 'integrity', scopeId] as const,

  job: (jobId: string) => [...libraryKeys.all, 'job', jobId] as const,
};

/**
 * Invalidates all item-related queries for a library scope (and optionally a collection).
 * Use after any mutation that modifies the library items.
 */
function invalidateLibraryItems(
  queryClient: ReturnType<typeof import('@tanstack/react-query').useQueryClient>,
  scopeId: string,
  collectionId?: string | null,
): void {
  queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
  if (collectionId) {
    queryClient.invalidateQueries({ queryKey: itemKeys.byCollection(scopeId, collectionId) });
  }
}

/**
 * Executes file uploads with a controlled concurrency pool to prevent saturating
 * the browser network stack or Fastify upload limits, while reporting item progress.
 */
async function uploadFilesWithConcurrency(
  files: File[],
  concurrencyLimit: number,
  uploadWorker: (file: File, count: number) => Promise<void>,
): Promise<{ successCount: number; lastErrorMessage: string | null }> {
  let taskIndex = 0;
  let completedCount = 0;
  let successCount = 0;
  let lastErrorMessage: string | null = null;
  const pool = [...files];

  const workers = Array.from(
    { length: Math.min(concurrencyLimit, files.length) },
    async () => {
      while (pool.length > 0) {
        const file = pool.shift();
        if (!file) break;
        taskIndex++;
        const currentTaskNumber = taskIndex;
        try {
          await uploadWorker(file, currentTaskNumber);
          successCount++;
        } catch (err: any) {
          lastErrorMessage = err?.message || 'File upload error';
        } finally {
          completedCount++;
        }
      }
    },
  );

  await Promise.all(workers);
  return { successCount, lastErrorMessage };
}

export interface PendingUploadItem {
  id: string;
  file: File;
  filename: string;
  size: number;
  collectionId?: string | null;
  status: 'uploading' | 'processing' | 'succeeded' | 'failed';
  error?: string;
  fileId?: string;
  runId?: string;
  createdAt: string;
  resolvedTitle?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (id?: string | null): id is string => Boolean(id && UUID_REGEX.test(id));

const isPendingId = (id: string, pendingUploads: PendingUploadItem[] = []) =>
  !isUuid(id) ||
  id.startsWith('temp-') ||
  id.startsWith('upload-') ||
  pendingUploads.some((p) => p.id === id);

// ── 1. Unified Main Library View Model Hook ──────────────────────────────────

export function useLibrary() {
  const params = useParams() as { collectionId?: string };
  const collectionId = params.collectionId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTags = useMemo(() => {
    const raw = searchParams.getAll('tag');
    if (!raw.length) return [];
    return raw
      .flatMap((t: string) => t.split(','))
      .map((t: string) => decodeURIComponent(t.trim()))
      .filter(Boolean);
  }, [searchParams]);
  const activeTag = activeTags.length > 0 ? activeTags.join(',') : searchParams.get('tag');
  const activeFilter = searchParams.get('filter');

  // Academic Multi-Criteria Filter Parameters
  const fileStatus = (searchParams.get('fileStatus') as any) || 'all';
  const readStatus = (searchParams.get('readStatus') as any) || 'all';
  const itemTypes = useMemo(() => {
    const raw = searchParams.getAll('type');
    if (!raw.length) return [];
    return raw
      .flatMap((t: string) => t.split(','))
      .map((t: string) => decodeURIComponent(t.trim()).toLowerCase())
      .filter(Boolean);
  }, [searchParams]);
  const fromYear = searchParams.get('fromYear') ? parseInt(searchParams.get('fromYear')!, 10) : null;
  const toYear = searchParams.get('toYear') ? parseInt(searchParams.get('toYear')!, 10) : null;
  const startDate = searchParams.get('startDate') || null;
  const endDate = searchParams.get('endDate') || null;

  const queryClient = useQueryClient();

  // Active Library Scope (Personal vs Project)
  const { activeScope } = useLibrarySidebarStore();
  const effectiveScopeId = activeScope.type === 'project' ? activeScope.id : 'user';
  const projectId = activeScope.type === 'project' ? activeScope.id : undefined;
  const userId = activeScope.type === 'personal' ? activeScope.id : undefined;
  const scopeId = effectiveScopeId;

  // Data Layer Services
  const itemsHook = useItems({ scopeId: effectiveScopeId, collectionId: '' });
  const rawPapers = useMemo(
    () => itemsHook.state.allPapers ?? [],
    [itemsHook.state.allPapers],
  );

  // Optimistic items generated from pending uploads (raw uploaded files)
  const [pendingUploads, setPendingUploads] = useState<PendingUploadItem[]>([]);

  const optimisticItems: Item[] = useMemo(() => {
    return pendingUploads.map((p) => ({
      id: p.id,
      title: p.resolvedTitle || p.filename,
      itemType: 'document',
      creators: [],
      publicationTitle: `${(p.size / (1024 * 1024)).toFixed(1)} MB`,
      year: new Date().getFullYear(),
      dateAdded: p.createdAt,
      createdAt: p.createdAt,
      updatedAt: p.createdAt,
      collectionId: p.collectionId || null,
      isPending: true,
      pendingStatus: p.status,
      pendingError: p.error,
    } as unknown as Item));
  }, [pendingUploads]);

  const allPapers = useMemo(() => {
    if (!optimisticItems.length) return rawPapers;

    // Seamlessly replace optimistic attachment items once processed (matching Zotero):
    // Filter out any optimistic placeholder that:
    // 1. Is marked 'succeeded'
    // 2. Or already has a corresponding paper in rawPapers (by attachment fileId/filename, or matching title)
    const activeOptimistic = optimisticItems.filter((opt) => {
      const p = pendingUploads.find((item) => item.id === opt.id);
      if (!p || p.status === 'succeeded') return false;

      const existsInRaw = rawPapers.some((raw) => {
        const rawAttachments = (raw as any).attachments;
        if (Array.isArray(rawAttachments) && rawAttachments.length > 0) {
          const hasMatch = rawAttachments.some((att: any) => {
            if (
              p.fileId &&
              (att.fileId === p.fileId ||
                att.id === p.fileId ||
                att.storageKey === p.fileId)
            ) {
              return true;
            }
            if (
              p.filename &&
              (att.name === p.filename ||
                att.originalName === p.filename ||
                att.filename === p.filename)
            ) {
              return true;
            }
            return false;
          });
          if (hasMatch) return true;
        }

        if (
          p.resolvedTitle &&
          raw.title &&
          raw.title.trim().toLowerCase() === p.resolvedTitle.trim().toLowerCase()
        ) {
          return true;
        }

        // Only deduplicate by fileId or resolved title match (title===filename match is too loose and can hide unrelated papers)

        return false;
      });

      return !existsInRaw;
    });

    return [...activeOptimistic, ...rawPapers];
  }, [optimisticItems, rawPapers, pendingUploads]);
  const isPapersLoading = itemsHook.state.isLoadingAll;
  const collectionService = useCollections(effectiveScopeId);
  const collections = collectionService.state.collections;
  const { ingest: ingestUnified } = useUnifiedIngest(effectiveScopeId);
  const ingestProgress = useIngestProgress(effectiveScopeId);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] = useState(false);

  // Computed Maps & Duplicate Indexes
  const collectionMap = useMemo(
    () => Object.fromEntries(collections.map((collection) => [collection.id, collection])),
    [collections],
  );

  const descendantIds = useMemo(
    () => (collectionId ? getDescendantIds(collectionId, collections) : undefined),
    [collectionId, collections],
  );

  const duplicateIds = useMemo(() => {
    const clusters = LibraryFilterEngine.findDuplicates(allPapers);
    const set = new Set<string>();
    for (const group of clusters) {
      set.add(group.original.id);
      for (const d of group.duplicates) {
        set.add(d.id);
      }
    }
    return set;
  }, [allPapers]);

  const savedSearchId = searchParams.get('savedSearchId');
  const isSavedSearchActive = activeFilter === 'saved-search' && Boolean(savedSearchId);
  const savedSearchResults = useSavedSearchResults(
    effectiveScopeId,
    isSavedSearchActive ? savedSearchId : null,
  );

  const filteredPapers = useMemo(() => {
    let list: Item[] = [];
    if (isSavedSearchActive && savedSearchResults.data?.items) {
      const items = savedSearchResults.data.items;
      if (!searchQuery.trim()) {
        list = items;
      } else {
        const q = searchQuery.toLowerCase();
        list = items.filter(
          (it: Item) =>
            it.title?.toLowerCase().includes(q) ||
            it.publicationTitle?.toLowerCase().includes(q),
        );
      }
    } else {
      list = sortFilterItems({
        items: rawPapers,
        searchQuery,
        activeFilter,
        activeTag,
        activeTags,
        activeCollectionId: collectionId,
        collectionIds: descendantIds,
        duplicateItemIds: duplicateIds,
        fileStatus,
        readStatus,
        itemTypes,
        fromYear,
        toYear,
        startDate,
        endDate,
      });
    }

    if (optimisticItems.length > 0) {
      // Only show optimistic upload placeholders in views where they make sense:
      // - If a collection is active, only show optimistic items belonging to that collection.
      // - If a special filter is active (duplicates, flagged, retracted, etc.),
      //   don't show optimistic items at all — they can't satisfy those criteria.
      const matchingOptimistic = collectionId
        ? optimisticItems.filter((o) => (o as any).collectionId === collectionId)
        : activeFilter && activeFilter !== 'all' && activeFilter !== 'recent'
        ? [] // don't show optimistic items in filtered views like duplicates/flagged
        : optimisticItems;

      const visibleOptimistic = searchQuery.trim()
        ? matchingOptimistic.filter((p) =>
            p.title?.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : matchingOptimistic;

      if (visibleOptimistic.length > 0) {
        return [...visibleOptimistic, ...list];
      }
    }

    return list;
  }, [
    isSavedSearchActive,
    savedSearchResults.data?.items,
    rawPapers,
    optimisticItems,
    searchQuery,
    activeFilter,
    activeTag,
    activeTags,
    collectionId,
    descendantIds,
    duplicateIds,
    fileStatus,
    readStatus,
    itemTypes,
    fromYear,
    toYear,
    startDate,
    endDate,
  ]);

  const selectedPaper = useMemo(
    () => (isSavedSearchActive ? savedSearchResults.data?.items ?? allPapers : allPapers).find((paper: Paper) => paper.id === selectedPaperId) || null,
    [isSavedSearchActive, savedSearchResults.data?.items, allPapers, selectedPaperId],
  );

  const selectedCollection = useMemo(
    () =>
      collectionId
        ? collectionMap[collectionId] ?? null
        : selectedPaper?.collectionId
        ? collectionMap[selectedPaper.collectionId] ?? null
        : null,
    [collectionId, selectedPaper, collectionMap],
  );

  // Action Handlers
  const addPaper = itemsHook.actions.addPaper;
  const handleAddPaper = useCallback(
    async (paperPayload: Parameters<typeof addPaper>[0]) => {
      return await addPaper(paperPayload);
    },
    [addPaper],
  );


  const uploadAndProcessFiles = useCallback(
    async (files: File[], batchTitle?: string) => {
      if (!files.length) return;

      // 1. Immediately create and register optimistic pending items in Library table
      const newPendingItems: PendingUploadItem[] = files.map((file) => ({
        id: `temp-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        filename: file.name,
        size: file.size,
        collectionId: collectionId || null,
        status: 'uploading' as const,
        createdAt: new Date().toISOString(),
      }));

      setPendingUploads((prev) => [...newPendingItems, ...prev]);

      // 2. Open ProcessModal to track real-time progress
      const modalTitle =
        batchTitle ||
        (files.length === 1 ? files[0].name : `${files.length} document(s)`);
      ingestProgress.startBatchProgress(
        files.map((f) => ({ name: f.name })),
        modalTitle,
      );

      // Track successfully submitted runs to monitor in background
      const submittedRuns: Array<{ tempId: string; file: File; runId: string }> = [];

      // 3. Process file uploads and pipeline submission with concurrency pool of 3
      // Workers only upload and submit — they do NOT block waiting for pipeline execution.
      const { lastErrorMessage } = await uploadFilesWithConcurrency(
        files,
        3,
        async (file: File) => {
          const pendingItem = newPendingItems.find((p) => p.file === file);
          const tempId = pendingItem?.id || file.name;

          try {
            const isRecord = /\.(bib|bibtex|ris)$/i.test(file.name);

            if (isRecord) {
              setPendingUploads((prev) =>
                prev.map((p) =>
                  p.id === tempId ? { ...p, status: 'processing' } : p,
                ),
              );

              const content = await file.text();
              const isRis = /\.ris$/i.test(file.name);
              const format = isRis ? 'RIS' : 'BIBTEX';

              const res = await IngestionService.submit(effectiveScopeId, {
                kind: 'RECORD',
                format,
                content,
                recordFormat: format,
                rawRecord: content,
                collectionId: collectionId || undefined,
              });

              const runId = (res as any)?.data?.runId || (res as any)?.runId;
              if (runId) {
                submittedRuns.push({ tempId, file, runId });
                setPendingUploads((prev) =>
                  prev.map((p) =>
                    p.id === tempId ? { ...p, runId } : p,
                  ),
                );
              }
            } else {
              // Binary upload
              setPendingUploads((prev) =>
                prev.map((p) =>
                  p.id === tempId ? { ...p, status: 'uploading' } : p,
                ),
              );

              const uploadRes = await uploadLibraryFile(effectiveScopeId, file);
              if (!uploadRes?.fileId) {
                throw new Error(`Upload failed for ${file.name}`);
              }

              // Pipeline submitted
              setPendingUploads((prev) =>
                prev.map((p) =>
                  p.id === tempId
                    ? { ...p, status: 'processing', fileId: uploadRes.fileId }
                    : p,
                ),
              );

              const res = await IngestionService.submit(effectiveScopeId, {
                kind: 'FILE',
                fileId: uploadRes.fileId,
                filename: file.name,
                collectionId: collectionId || undefined,
              });

              const runId = (res as any)?.data?.runId || (res as any)?.runId;
              if (runId) {
                submittedRuns.push({ tempId, file, runId });
                setPendingUploads((prev) =>
                  prev.map((p) =>
                    p.id === tempId ? { ...p, runId } : p,
                  ),
                );
              }
            }
          } catch (err: any) {
            const errorMsg = err?.message || 'Upload failed';
            ingestProgress.updateBatchItem(file.name, 'FAILED', errorMsg);
            setPendingUploads((prev) =>
              prev.map((p) =>
                p.id === tempId ? { ...p, status: 'failed', error: errorMsg } : p,
              ),
            );
            setTimeout(() => {
              setPendingUploads((prev) => prev.filter((p) => p.id !== tempId));
            }, 6000);
            throw err;
          }
        },
      );

      // 4. Unified resilient batch monitoring
      let succeededCount = 0;
      if (submittedRuns.length > 0) {
        const pendingRunMap = new Map(
          submittedRuns.map((r) => [r.runId, r]),
        );
        const startPoll = Date.now();
        const MAX_BATCH_WAIT_MS = 240000; // 4 minutes max

        while (
          pendingRunMap.size > 0 &&
          Date.now() - startPoll < MAX_BATCH_WAIT_MS
        ) {
          await new Promise((r) => setTimeout(r, 2000));

          const activeRunIds = Array.from(pendingRunMap.keys());
          const chunks: string[][] = [];
          for (let i = 0; i < activeRunIds.length; i += 4) {
            chunks.push(activeRunIds.slice(i, i + 4));
          }

          let batchChanged = false;
          for (const chunk of chunks) {
            await Promise.all(
              chunk.map(async (runId) => {
                const itemInfo = pendingRunMap.get(runId);
                if (!itemInfo) return;
                try {
                  const res = await IngestionService.getRunStatus(
                    effectiveScopeId,
                    runId,
                  );
                  const rawStatus =
                    res?.data?.status || (res as any)?.status;
                  const s = String(rawStatus || '').toUpperCase();

                  if (
                    s === 'READY' ||
                    s === 'COMPLETED' ||
                    s === 'COMMITTED'
                  ) {
                    pendingRunMap.delete(runId);
                    succeededCount++;
                    batchChanged = true;
                    const resolvedTitle =
                      (res?.data as any)?.title ||
                      (res?.data as any)?.item?.title ||
                      (res?.data as any)?.executionLog?.currentTitle ||
                      (res?.data as any)?.executionLog?.items?.[0]?.title ||
                      (res?.data as any)?.executionLog?.item?.title ||
                      (res?.data as any)?.snapshot?.title ||
                      (res as any)?.title ||
                      (res as any)?.item?.title ||
                      (res as any)?.executionLog?.currentTitle ||
                      (res as any)?.executionLog?.items?.[0]?.title;
                    ingestProgress.updateBatchItem(
                      itemInfo.file.name,
                      'SUCCEEDED',
                      undefined,
                      resolvedTitle,
                    );
                    setPendingUploads((prev) =>
                      prev.filter((p) => p.id !== itemInfo.tempId),
                    );
                  } else if (s.startsWith('FAIL') || s === 'ERROR') {
                    pendingRunMap.delete(runId);
                    batchChanged = true;
                    const errMsg =
                      (res?.data as any)?.errorMessage ||
                      (res?.data as any)?.lastError ||
                      (res?.data as any)?.error ||
                      (res as any)?.error ||
                      'Metadata extraction failed';
                    ingestProgress.updateBatchItem(
                      itemInfo.file.name,
                      'FAILED',
                      errMsg,
                    );
                    setPendingUploads((prev) =>
                      prev.map((p) =>
                        p.id === itemInfo.tempId
                          ? { ...p, status: 'failed', error: errMsg }
                          : p,
                      ),
                    );
                    setTimeout(() => {
                      setPendingUploads((prev) =>
                        prev.filter((p) => p.id !== itemInfo.tempId),
                      );
                    }, 6000);
                  }
                } catch (err: unknown) {
                  // Transient polling error, keep waiting
                  console.warn('[Ingestion Poll Error]:', err);
                }
              }),
            );
          }

          if (batchChanged) {
            invalidateLibraryItems(
              queryClient,
              effectiveScopeId,
              collectionId,
            );
            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['library'] });
          }
        }
      }

      // 5. Wrap up batch progress
      ingestProgress.finishBatchProgress(lastErrorMessage || undefined);
      setPendingUploads((prev) =>
        prev.filter(
          (p) => !files.some((f) => f === p.file || f.name === p.filename),
        ),
      );
      invalidateLibraryItems(
        queryClient,
        effectiveScopeId,
        collectionId,
      );
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });

      if (succeededCount > 0) {
        toast.success('Import completed', {
          description: `${succeededCount} of ${files.length} document(s) added to library.`,
        });
      } else if (lastErrorMessage) {
        toast.error('Import failed', {
          description: lastErrorMessage,
        });
      }
    },
    [
      collectionId,
      effectiveScopeId,
      queryClient,
      ingestProgress,
    ],
  );

  const handleDirectFilesUpload = useCallback(
    async (files: File[]) => {
      await uploadAndProcessFiles(files);
    },
    [uploadAndProcessFiles],
  );

  const handleDirectFolderUpload = useCallback(
    async (files: File[], folderName: string) => {
      await uploadAndProcessFiles(files, `Importing "${folderName}"`);
    },
    [uploadAndProcessFiles],
  );

  const handleAddLinkSubmit = useCallback(
    async (linkData: AddLinkData) => {
      try {
        const rawInput = (linkData.url || linkData.doi || '').trim();

        if (rawInput) {
          const doiMatch = rawInput.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+)\b/i);
          const arxivMatch = rawInput.match(
            /(?:arxiv:\s*|https?:\/\/arxiv\.org\/(?:abs|pdf|html)\/)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[a-z]{2})?\/\d{7})(?:\.pdf)?/i,
          );
          const pmidMatch = rawInput.match(
            /(?:pmid:\s*|https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/)(\d{1,9})/i,
          );
          const cleanDigits = rawInput.replace(/[-\s]/g, '');
          const isIsbn =
            /^(?:isbn:?\s*)?(97[89]\d{10}|\d{9}[\dX])$/i.test(rawInput) ||
            ((cleanDigits.length === 10 || cleanDigits.length === 13) &&
              /^\d+X?$/i.test(cleanDigits) &&
              !cleanDigits.startsWith('10.'));

          const isArxiv = Boolean(
            rawInput.toLowerCase().includes('arxiv') ||
            rawInput.toLowerCase().startsWith('arxiv:') ||
            (/^\d{4}\.\d{4,5}(?:v\d+)?$/i.test(rawInput)) ||
            (/^[a-z-]+(?:\.[a-z]{2})?\/\d{7}$/i.test(rawInput))
          );
          const isDoi = Boolean(
            !isArxiv && (doiMatch || linkData.doi || rawInput.startsWith('10.'))
          );
          const isPmid = Boolean(
            rawInput.toLowerCase().startsWith('pmid:') ||
              rawInput.includes('pubmed.ncbi') ||
              (pmidMatch && /^\d{7,8}$/.test(rawInput)),
          );

          let submissionPayload: Parameters<typeof IngestionService.submit>[1];

          if (isArxiv && arxivMatch && arxivMatch[1]) {
            const cleanArxiv = arxivMatch[1].replace(/^arxiv:\s*/i, '').replace(/\.pdf$/i, '').trim();
            submissionPayload = {
              kind: 'IDENTIFIER',
              identifierType: 'ARXIV',
              value: cleanArxiv,
              collectionId: collectionId || undefined,
              overrides: linkData.title ? { title: linkData.title } : undefined,
            };
          } else if (isDoi) {
            let cleanDoi = (linkData.doi || (doiMatch ? doiMatch[1] : rawInput)).trim();
            cleanDoi = cleanDoi.replace(/[.,;]+$/, '');
            if (cleanDoi.endsWith(')') && !cleanDoi.includes('(')) cleanDoi = cleanDoi.slice(0, -1);
            if (cleanDoi.endsWith(']') && !cleanDoi.includes('[')) cleanDoi = cleanDoi.slice(0, -1);

            submissionPayload = {
              kind: 'IDENTIFIER',
              identifierType: 'DOI',
              value: cleanDoi,
              collectionId: collectionId || undefined,
              overrides: linkData.title ? { title: linkData.title } : undefined,
            };
          } else if (isPmid && pmidMatch) {
            submissionPayload = {
              kind: 'IDENTIFIER',
              identifierType: 'PMID',
              value: pmidMatch[1],
              collectionId: collectionId || undefined,
              overrides: linkData.title ? { title: linkData.title } : undefined,
            };
          } else if (isIsbn) {
            submissionPayload = {
              kind: 'IDENTIFIER',
              identifierType: 'ISBN',
              value: rawInput.replace(/^isbn:?\s*/i, '').trim(),
              collectionId: collectionId || undefined,
              overrides: linkData.title ? { title: linkData.title } : undefined,
            };
          } else {
            submissionPayload = {
              kind: 'URL',
              url: rawInput,
              filename: linkData.filename,
              collectionId: collectionId || undefined,
              overrides: linkData.title ? { title: linkData.title } : undefined,
            };
          }

          const res = await IngestionService.submit(effectiveScopeId, submissionPayload);
          const runId = (res as any)?.data?.runId || (res as any)?.runId;
          if (runId) {
            ingestProgress.startMonitoring(runId, linkData.title || rawInput);
            return;
          } else {
            // Item was likely already in library (deduplication) — refresh the list
            await queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScopeId) });
            toast.success('Item added to library');
          }
        } else {
          await handleAddPaper({
            title: linkData.title || 'Document',
            authors: linkData.authors || [],
            year: typeof linkData.year === 'number' ? linkData.year : (linkData.year ? parseInt(String(linkData.year), 10) || null : null),
            doi: linkData.doi,
            abstract: linkData.abstract,
            fileUrl: linkData.fileUrl || '',
            filename: linkData.filename || 'document.pdf',
            mimeType: linkData.mimeType || 'application/pdf',
            size: linkData.size || 0,
            collectionId: collectionId || undefined,
            journal: linkData.journal,
            publisher: linkData.publisher,
            volume: linkData.volume,
            issue: linkData.issue,
            pages: linkData.pages,
            url: linkData.url,
            type: linkData.type,
          });
        }
        invalidateLibraryItems(queryClient, effectiveScopeId, collectionId);
      } catch (err: any) {
        toast.error('Import failed', {
          description: err?.message || 'Could not process identifier or document.',
        });
      }
    },
    [effectiveScopeId, collectionId, handleAddPaper, queryClient, ingestProgress],
  );

  const handleCreateManualItem = useCallback(
    async (itemType: string = 'journalArticle') => {
      try {
        const created = await itemsHook.actions.createItem({
          title: 'Untitled Reference',
          itemType,
          collectionId: collectionId || undefined,
        });
        const createdItem = (created as any)?.item || created;
        if (createdItem?.id) {
          setSelectedPaperId(createdItem.id);
        }
        invalidateLibraryItems(queryClient, effectiveScopeId, collectionId);
        toast.success('Created new reference', {
          description: `Added new ${itemType} to library.`,
        });
        return createdItem;
      } catch (err: any) {
        toast.error('Failed to create reference', {
          description: err?.message || 'Could not create new item.',
        });
      }
    },
    [itemsHook.actions, collectionId, queryClient, effectiveScopeId],
  );


  const handleCreateCollection = useCallback(
    (collectionData: CollectionInput) => {
      const rawParent = collectionData.parentId ?? collectionData.parent ?? null;
      const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
      collectionService.actions.create(
        {
          ...collectionData,
          parentId: cleanParentId,
          parent: cleanParentId,
        },
        {
          onSuccess: () => setIsCreateCollectionModalOpen(false),
        },
      );
    },
    [collectionService.actions],
  );

  const handleDeletePaper = useCallback(
    (paperId: string) => {
      if (isPendingId(paperId, pendingUploads)) {
        setPendingUploads((prev) => prev.filter((p) => p.id !== paperId));
        if (selectedPaperId === paperId) setSelectedPaperId(null);
        return;
      }
      itemsHook.actions.deletePaper({ paperId });
      if (selectedPaperId === paperId) setSelectedPaperId(null);
    },
    [itemsHook.actions, pendingUploads, selectedPaperId],
  );

  const handleBatchDeletePapers = useCallback(
    async (paperIds: string[]) => {
      if (!paperIds.length) return;

      const optimisticIds = paperIds.filter((id) => isPendingId(id, pendingUploads));
      const persistedIds = paperIds.filter((id) => !optimisticIds.includes(id));

      if (optimisticIds.length > 0) {
        setPendingUploads((prev) => prev.filter((p) => !optimisticIds.includes(p.id)));
      }

      if (persistedIds.length === 0) {
        if (selectedPaperId && paperIds.includes(selectedPaperId)) {
          setSelectedPaperId(null);
        }
        toast.success('Removed', {
          description: `${optimisticIds.length} temporary item(s) removed.`,
        });
        return;
      }

      const loadingId = toast.loading(`Moving ${persistedIds.length} item(s) to trash...`, { id: 'batch-trash-action' });
      try {
        await Promise.all(
          persistedIds.map((paperId) => itemsHook.actions.deletePaper({ paperId, silent: true })),
        );
        if (selectedPaperId && paperIds.includes(selectedPaperId)) {
          setSelectedPaperId(null);
        }
        toast.success('Moved to trash', {
          description: `${persistedIds.length} document(s) moved to trash.`,
          id: loadingId,
        });
      } catch (err: any) {
        toast.error('Failed to delete items', {
          description: err?.message || 'Could not move selected documents to trash.',
          id: loadingId,
        });
      }
    },
    [itemsHook.actions, pendingUploads, selectedPaperId],
  );

  const handleBatchMovePapers = useCallback(
    async (paperIds: string[], targetCollectionId: string | null) => {
      if (!paperIds.length) return;
      const persistedIds = paperIds.filter((id) => !isPendingId(id, pendingUploads));
      if (persistedIds.length === 0) {
        toast.info('Selected pending uploads cannot be moved until processing finishes.');
        return;
      }
      const loadingId = toast.loading(`Moving ${persistedIds.length} item(s)...`, { id: 'batch-move-action' });
      try {
        await Promise.all(
          persistedIds.map((paperId) =>
            itemsHook.actions.updatePaper({
              paperId,
              collectionId: targetCollectionId ?? undefined,
              silent: true,
            }),
          ),
        );
        toast.success('Documents moved', {
          description: `Moved ${persistedIds.length} item(s) to target collection.`,
          id: loadingId,
        });
      } catch (err: any) {
        toast.error('Failed to move items', {
          description: err?.message || 'Could not move selected documents.',
          id: loadingId,
        });
      }
    },
    [itemsHook.actions, pendingUploads],
  );

  return {
    state: {
      activeScope,
      effectiveScopeId,
      scopeId,
      projectId,
      userId,
      items: allPapers,
      papers: allPapers,
      collections,
      isLoading: isPapersLoading,
      search: searchQuery,
      activeTags,
      activeTag,
      activeFilter,
      fileStatus,
      readStatus,
      itemTypes,
      fromYear,
      toYear,
      selectedItemId: selectedPaperId,
      selectedPaperId,
      selectedItem: selectedPaper,
      selectedPaper,
      filtered: filteredPapers,
      filteredItems: filteredPapers,
      filteredPapers,
      selectedCollection,
      collectionMap,
      addLinkOpen: isAddLinkModalOpen,
      createCollectionOpen: isCreateCollectionModalOpen,
      isAddingItem: itemsHook.state.isAdding,
      isAddingPaper: itemsHook.state.isAdding,
      isCreatingCollection: collectionService.state.isCreating,
      ingestProgressModal: ingestProgress.modalState,
      activeSavedSearch: savedSearchResults.data?.savedSearch ?? null,
      isSavedSearchActive,
      pendingUploads,
    },
    actions: {
      setSearch: setSearchQuery,
      setSelectedItemId: setSelectedPaperId,
      setSelectedPaperId,
      setAddLinkOpen: setIsAddLinkModalOpen,
      handleDirectFilesUpload,
      handleDirectFolderUpload,
      handleAddLinkSubmit,
      setCreateCollectionOpen: setIsCreateCollectionModalOpen,
      handleAddItem: handleAddPaper,
      handleAddPaper,
      handleCreateManualItem,
      handleCreateCollection,
      handleDeleteItem: handleDeletePaper,
      handleDeletePaper,
      handleBatchDeleteItems: handleBatchDeletePapers,
      handleBatchDeletePapers,
      handleBatchMoveItems: handleBatchMovePapers,
      handleBatchMovePapers,
      closeProcessModal: ingestProgress.closeModal,
      toggleMinimizeProcessModal: ingestProgress.toggleMinimize,
      startMonitoringIngest: ingestProgress.startMonitoring,
      navigate: router.push,
    },
  };
}

// ── Specialized Hooks (Consolidated) ─────────────────────────────────────────

export { useCollections } from './use-collections';
export { useAsyncJobStatus } from './use-ingestion';

export function useCslCitation(
  scopeId?: string,
  paperId?: string,
  style: CslStyle = 'apa',
  index: number = 1,
) {
  return useQuery({
    queryKey: libraryKeys.citationItem(scopeId || 'default', paperId || 'none', style, index),
    queryFn: () => formatCslCitation(scopeId, paperId || '', style, index),
    enabled: Boolean(paperId),
    staleTime: 1000 * 60 * 30,
  });
}

// ── Quality & Duplicate Hooks ──

export {
  useDuplicateGroups,
  useMergePapers,
  useLibraryIntegrity,
  useDuplicates,
  useMergeItems,
  useIntegrity,
} from './use-curation';
