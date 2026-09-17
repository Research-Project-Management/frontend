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

  items: (workspaceId: string) => [...libraryKeys.all, 'items', workspaceId] as const,
  itemList: (workspaceId: string, filter?: ItemQueryParams) =>
    [...libraryKeys.items(workspaceId), 'list', filter] as const,
  itemDetail: (workspaceId: string, itemId: string) =>
    [...libraryKeys.items(workspaceId), 'detail', itemId] as const,
  itemBundle: (workspaceId: string, itemId: string) =>
    [...libraryKeys.items(workspaceId), 'bundle', itemId] as const,

  // Aliases kept for backward compat with useLinkPapers / useMergePapers consumers
  papers: (workspaceId: string) => [...libraryKeys.all, 'items', workspaceId] as const,
  paperBundle: (workspaceId: string, itemId: string) =>
    [...libraryKeys.items(workspaceId), 'bundle', itemId] as const,

  collections: (workspaceId: string) =>
    [...libraryKeys.all, 'collections', workspaceId] as const,

  citations: (workspaceId: string) =>
    [...libraryKeys.all, 'citations', workspaceId] as const,
  citationItem: (workspaceId: string, itemId: string, style: CslStyle, index: number = 1) =>
    [...libraryKeys.citations(workspaceId), itemId, style, index] as const,

  annotations: (workspaceId: string, itemId: string) =>
    [...libraryKeys.all, 'annotations', workspaceId, itemId] as const,

  relations: (workspaceId: string, itemId: string) =>
    [...libraryKeys.all, 'relations', workspaceId, itemId] as const,

  duplicates: (workspaceId: string) =>
    [...libraryKeys.all, 'duplicates', workspaceId] as const,
  integrity: (workspaceId: string) =>
    [...libraryKeys.all, 'integrity', workspaceId] as const,

  job: (jobId: string) => [...libraryKeys.all, 'job', jobId] as const,
};

/**
 * Invalidates all item-related queries for a workspace (and optionally a collection).
 * Use after any mutation that modifies the library items.
 */
function invalidateLibraryItems(
  queryClient: ReturnType<typeof import('@tanstack/react-query').useQueryClient>,
  workspaceId: string,
  workspaceSlug: string | undefined,
  collectionId: string | undefined | null,
): void {
  queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
  if (workspaceSlug && workspaceSlug !== workspaceId) {
    queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceSlug) });
  }
  if (collectionId) {
    queryClient.invalidateQueries({ queryKey: itemKeys.byCollection(workspaceId, collectionId) });
    if (workspaceSlug && workspaceSlug !== workspaceId) {
      queryClient.invalidateQueries({ queryKey: itemKeys.byCollection(workspaceSlug, collectionId) });
    }
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
        try {
          await uploadWorker(file, completedCount + 1);
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
}

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
  const workspaceId = effectiveScopeId;
  const workspaceSlug = effectiveScopeId;

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
      title: p.filename,
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
    return [...optimisticItems, ...rawPapers];
  }, [optimisticItems, rawPapers]);
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
      const matchingOptimistic = searchQuery.trim()
        ? optimisticItems.filter((p) =>
            p.title?.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : optimisticItems;
      return [...matchingOptimistic, ...list];
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
                      (res?.data as any)?.item?.title ||
                      (res?.data as any)?.snapshot?.title ||
                      (res?.data as any)?.title ||
                      (res as any)?.title;
                    ingestProgress.updateBatchItem(
                      itemInfo.file.name,
                      'SUCCEEDED',
                      undefined,
                      resolvedTitle,
                    );
                    setPendingUploads((prev) =>
                      prev.map((p) =>
                        p.id === itemInfo.tempId
                          ? { ...p, status: 'succeeded' }
                          : p,
                      ),
                    );
                    setTimeout(() => {
                      setPendingUploads((prev) =>
                        prev.filter((p) => p.id !== itemInfo.tempId),
                      );
                    }, 800);
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
                } catch {
                  // Transient polling error, keep waiting
                }
              }),
            );
          }

          if (batchChanged) {
            invalidateLibraryItems(
              queryClient,
              workspaceId,
              workspaceSlug,
              collectionId,
            );
            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['library'] });
          }
        }
      }

      // 5. Wrap up batch progress
      ingestProgress.finishBatchProgress(lastErrorMessage || undefined);
      invalidateLibraryItems(
        queryClient,
        workspaceId,
        workspaceSlug,
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
      workspaceId,
      workspaceSlug,
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
            /(?:arxiv:\s*|https?:\/\/arxiv\.org\/(?:abs|pdf|html)\/)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[a-z]{2})?\/\d{7})/i,
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

          const isPureDoi =
            rawInput.startsWith('10.') ||
            (doiMatch && !rawInput.includes('http') && !rawInput.includes('arxiv'));
          const isArxiv = Boolean(
            rawInput.toLowerCase().includes('arxiv') ||
              (arxivMatch && !doiMatch && /^\d{4}\.\d{4,5}/.test(rawInput)),
          );
          const isPmid = Boolean(
            rawInput.toLowerCase().startsWith('pmid:') ||
              rawInput.includes('pubmed.ncbi') ||
              (pmidMatch && /^\d{7,8}$/.test(rawInput)),
          );

          let submissionPayload: Parameters<typeof IngestionService.submit>[1];

          if (isPureDoi || linkData.doi) {
            const doi = linkData.doi || (doiMatch ? doiMatch[1] : rawInput);
            submissionPayload = {
              kind: 'IDENTIFIER',
              identifierType: 'DOI',
              value: doi,
              collectionId: collectionId || undefined,
              overrides: linkData.title ? { title: linkData.title } : undefined,
            };
          } else if (isArxiv && arxivMatch) {
            submissionPayload = {
              kind: 'IDENTIFIER',
              identifierType: 'ARXIV',
              value: arxivMatch[1],
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
              collectionId: collectionId || undefined,
              overrides: linkData.title ? { title: linkData.title } : undefined,
            };
          }

          const res = await IngestionService.submit(effectiveScopeId, submissionPayload);
          const runId = (res as any)?.data?.runId || (res as any)?.runId;
          if (runId) {
            ingestProgress.startMonitoring(runId, linkData.title || rawInput);
            return;
          }
        } else {
          await handleAddPaper({
            title: linkData.title || 'Document',
            authors: linkData.authors || [],
            year: linkData.year,
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
        invalidateLibraryItems(queryClient, workspaceId, workspaceSlug, collectionId);
      } catch (err: any) {
        toast.error('Import failed', {
          description: err?.message || 'Could not process identifier or document.',
        });
      }
    },
    [workspaceId, workspaceSlug, collectionId, handleAddPaper, queryClient, ingestProgress, effectiveScopeId],
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
      itemsHook.actions.deletePaper({ paperId });
      if (selectedPaperId === paperId) setSelectedPaperId(null);
    },
    [itemsHook.actions, selectedPaperId],
  );

  const handleBatchDeletePapers = useCallback(
    async (paperIds: string[]) => {
      if (!paperIds.length) return;
      const loadingId = toast.loading(`Moving ${paperIds.length} item(s) to trash...`, { id: 'batch-trash-action' });
      try {
        await Promise.all(
          paperIds.map((paperId) => itemsHook.actions.deletePaper({ paperId, silent: true })),
        );
        if (selectedPaperId && paperIds.includes(selectedPaperId)) {
          setSelectedPaperId(null);
        }
        toast.success('Moved to trash', {
          description: `${paperIds.length} document(s) moved to trash.`,
          id: loadingId,
        });
      } catch (err: any) {
        toast.error('Failed to delete items', {
          description: err?.message || 'Could not move selected documents to trash.',
          id: loadingId,
        });
      }
    },
    [itemsHook.actions, selectedPaperId],
  );

  const handleBatchMovePapers = useCallback(
    async (paperIds: string[], targetCollectionId: string | null) => {
      if (!paperIds.length) return;
      const loadingId = toast.loading(`Moving ${paperIds.length} item(s)...`, { id: 'batch-move-action' });
      try {
        await Promise.all(
          paperIds.map((paperId) =>
            itemsHook.actions.updatePaper({
              paperId,
              collectionId: targetCollectionId ?? undefined,
              silent: true,
            }),
          ),
        );
        toast.success('Documents moved', {
          description: `Moved ${paperIds.length} item(s) to target collection.`,
          id: loadingId,
        });
      } catch (err: any) {
        toast.error('Failed to move items', {
          description: err?.message || 'Could not move selected documents.',
          id: loadingId,
        });
      }
    },
    [itemsHook.actions],
  );

  return {
    state: {
      activeScope,
      effectiveScopeId,
      workspaceId,
      workspaceSlug,
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
  workspaceId?: string,
  paperId?: string,
  style: CslStyle = 'apa',
  index: number = 1,
) {
  return useQuery({
    queryKey: libraryKeys.citationItem(workspaceId || 'default', paperId || 'none', style, index),
    queryFn: () => formatCslCitation(workspaceId, paperId || '', style, index),
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
