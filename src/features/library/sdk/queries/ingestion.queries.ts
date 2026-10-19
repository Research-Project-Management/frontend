'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { libraryServices, IngestionService } from '../library.client';
import type { UnifiedIngestionPayload, FlagRetractionInput } from '@/features/library/domain/types/library.types';
import {
  itemKeys,
  ingestKeys,
  curationKeys,
  retractionKeys,
  invalidateCollections,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';
import {
  cleanDoi,
  extractArxivId,
  extractPmid,
  cleanIsbn,
} from '@/features/library/domain/identifiers';

export { ingestKeys, curationKeys, retractionKeys };

// ── Ingestion Run Polling (Pure SDK Helper) ───────────────────────────────────

export interface PollRunOutcome {
  ok: boolean;
  timedOut?: boolean;
  title?: string;
  itemId?: string;
  error?: string;
}

export interface PollIngestionRunOptions {
  fallbackTitle: string;
  initialItemId?: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  slowPollThresholdMs?: number;
  onSlowPollThreshold?: () => void;
  signal?: AbortSignal;
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((r) => setTimeout(r, ms));
  }
  if (signal.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function pollIngestionRunCompletion(
  scopeId: string,
  runId: string,
  opts: PollIngestionRunOptions,
): Promise<PollRunOutcome> {
  const startTime = Date.now();
  const maxWaitMs = opts.maxWaitMs ?? 120000;
  const pollIntervalMs = opts.pollIntervalMs ?? 1200;
  let finalTitle = opts.fallbackTitle;
  let finalItemId = opts.initialItemId;
  let slowThresholdTriggered = false;

  while (Date.now() - startTime < maxWaitMs) {
    if (opts.signal?.aborted) {
      return { ok: false, error: 'Polling aborted' };
    }
    await abortableSleep(pollIntervalMs, opts.signal);
    if (opts.signal?.aborted) {
      return { ok: false, error: 'Polling aborted' };
    }

    if (
      !slowThresholdTriggered &&
      opts.slowPollThresholdMs !== undefined &&
      opts.onSlowPollThreshold &&
      Date.now() - startTime >= opts.slowPollThresholdMs
    ) {
      slowThresholdTriggered = true;
      opts.onSlowPollThreshold();
    }

    try {
      const runStatus = await IngestionService.getRunStatus(scopeId, runId);
      const statusPayload = runStatus as {
        data?: {
          status?: string;
          title?: string;
          itemId?: string;
          lastError?: string;
          errorMessage?: string;
        };
        status?: string;
        title?: string;
        itemId?: string;
        lastError?: string;
        errorMessage?: string;
      } | null;
      const statusData = statusPayload?.data || statusPayload;
      const currentStatus = (statusData?.status || '').toUpperCase();

      if (
        currentStatus === 'COMPLETED' ||
        currentStatus === 'READY' ||
        currentStatus === 'SUCCEEDED' ||
        currentStatus === 'NEEDS_REVIEW'
      ) {
        if (statusData?.title && statusData.title !== 'Uploaded Document') {
          finalTitle = statusData.title;
        }
        if (statusData?.itemId) {
          finalItemId = statusData.itemId;
        }
        return { ok: true, title: finalTitle, itemId: finalItemId };
      }

      if (
        currentStatus === 'FAILED_FINAL' ||
        currentStatus === 'FAILED_RETRYABLE' ||
        currentStatus === 'CANCELLED' ||
        currentStatus === 'FAILED'
      ) {
        return {
          ok: false,
          error: statusData?.lastError || statusData?.errorMessage || 'Extraction failed',
        };
      }
    } catch {
      // Retry on transient poll network glitch
    }
  }

  // Non-blocking graceful handoff: file was safely stored and queued on server
  return { ok: true, timedOut: true, title: finalTitle, itemId: finalItemId };
}

// ── Identifier / Link Ingestion & Polling Orchestration ───────────────────────

export function buildIdentifierIngestionPayload(
  rawInput: string,
  options?: { collectionId?: string; title?: string },
): UnifiedIngestionPayload {
  const raw = rawInput.trim();
  const targetCollectionId = options?.collectionId || undefined;
  const userTitle = options?.title?.trim() || undefined;
  const overrides = userTitle ? { title: userTitle } : undefined;

  if (raw.startsWith('@')) {
    return {
      source: 'bibtex',
      content: raw,
      collectionId: targetCollectionId,
      ...(overrides ? { overrides } : {}),
    } as UnifiedIngestionPayload;
  }
  if (raw.startsWith('TY  -')) {
    return {
      source: 'ris',
      content: raw,
      collectionId: targetCollectionId,
      ...(overrides ? { overrides } : {}),
    } as UnifiedIngestionPayload;
  }

  // 1. Check arXiv first (including arxiv.org/abs/..., arxiv.org/pdf/..., 10.48550/arXiv..., (arXiv:...))
  const arxivCandidate = extractArxivId(raw);
  if (
    arxivCandidate &&
    (/arxiv/i.test(raw) || /^\(?\[?(?:arxiv:\s*)?(\d{4}\.\d{4,5}|[a-z-]+\/\d{7})/i.test(raw))
  ) {
    return { source: 'arxiv', arxivId: arxivCandidate, collectionId: targetCollectionId, overrides };
  }

  // 2. Check PubMed URL or PMID string
  const pmidCandidate = extractPmid(raw);
  if (pmidCandidate) {
    return { source: 'pmid', pmid: pmidCandidate, collectionId: targetCollectionId, overrides };
  }

  // 3. Check DOI (including doi.org, dx.doi.org, nature/zenodo/biorxiv/plos DOI URLs, or 10.NNNN/...)
  const doiCandidate = cleanDoi(raw);
  if (doiCandidate && /^10\.\d{4,9}\//.test(doiCandidate)) {
    return { source: 'doi', doi: doiCandidate, collectionId: targetCollectionId, overrides };
  }

  // 4. Check ISBN-10 / ISBN-13 (including ISBN-10 ending with X and hyphenated/spaced formats)
  const isbnCandidate = cleanIsbn(raw);
  if (isbnCandidate) {
    return { source: 'isbn', isbn: isbnCandidate, collectionId: targetCollectionId, overrides };
  }

  return { source: 'url', url: raw, collectionId: targetCollectionId, overrides };
}

export interface TrackedIdentifierIngestionOptions {
  scopeId: string;
  rawInput: string;
  title?: string;
  collectionId?: string;
  queryClient: QueryClient;
  onCloseModal: () => void;
  onAddProvisionalItem: (item: {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    scopeId: string;
    collectionId?: string;
    status: 'PROCESSING';
    progress: number;
    extractedTitle: string;
    createdAt: string;
  }) => void;
  onDismissProvisionalItem: (id: string) => void;
}

/**
 * Submits an identifier/URL/BibTeX/RIS payload and orchestrates fast-path completion,
 * background polling, provisional item display, and scoped cache synchronization.
 */
export async function executeTrackedIdentifierIngestion({
  scopeId,
  rawInput,
  title,
  collectionId,
  queryClient,
  onCloseModal,
  onAddProvisionalItem,
  onDismissProvisionalItem,
}: TrackedIdentifierIngestionOptions): Promise<void> {
  const raw = rawInput.trim();
  if (!raw) return;

  const targetCollectionId = collectionId || undefined;
  const userTitle = title?.trim() || undefined;
  const ingestionPayload = buildIdentifierIngestionPayload(raw, {
    collectionId: targetCollectionId,
    title: userTitle,
  });

  const toastId = toast.loading('Adding reference...', { id: 'add-identifier' });
  const provisionalId = `provisional-link-${Date.now()}`;
  let provisionalAdded = false;

  const syncLibraryQueries = async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: itemKeys.all(scopeId) }),
      queryClient.refetchQueries({ queryKey: itemKeys.counts(scopeId) }),
      targetCollectionId
        ? queryClient.refetchQueries({
            queryKey: itemKeys.byCollection(scopeId, targetCollectionId),
          })
        : Promise.resolve(),
    ]);
    invalidateCollections(queryClient, scopeId);
  };

  try {
    const ingestRes = await libraryServices.ingestion.ingest(scopeId, ingestionPayload);
    const ingestData = ingestRes?.data;
    const runId = ingestData?.runId;
    const initialStatus = (ingestData?.status || '').toUpperCase();
    const isAlreadyDone =
      initialStatus === 'COMPLETED' ||
      initialStatus === 'SUCCEEDED' ||
      initialStatus === 'READY' ||
      Boolean(ingestData?.deduplicated);

    const itemObj = ingestData?.item as Record<string, unknown> | undefined;
    let finalTitle = userTitle || (typeof itemObj?.title === 'string' ? itemObj.title : '');

    if (isAlreadyDone || !runId) {
      await syncLibraryQueries();
      toast.success(
        ingestData?.deduplicated ? 'Reference already in library' : 'Document imported',
        {
          description: finalTitle
            ? `"${finalTitle}" is ready in your library.`
            : 'Successfully added to your library.',
          id: toastId,
        },
      );
      onCloseModal();
      return;
    }

    let modalClosed = false;
    const pollOutcome = await pollIngestionRunCompletion(scopeId, runId, {
      fallbackTitle: finalTitle,
      pollIntervalMs: 700,
      maxWaitMs: 60000,
      slowPollThresholdMs: 3500,
      onSlowPollThreshold: () => {
        modalClosed = true;
        onCloseModal();
        provisionalAdded = true;
        onAddProvisionalItem({
          id: provisionalId,
          fileName: userTitle || raw,
          fileSize: 0,
          mimeType: 'text/html',
          scopeId,
          collectionId: targetCollectionId,
          status: 'PROCESSING',
          progress: 50,
          extractedTitle: userTitle || raw,
          createdAt: new Date().toISOString(),
        });
        toast.loading('Processing document in background...', {
          id: toastId,
          description: 'Extracting metadata. Your library will update automatically once ready.',
        });
      },
    });

    if (!pollOutcome.ok) {
      throw new Error(pollOutcome.error || 'Extraction failed');
    }

    finalTitle = pollOutcome.title || finalTitle;
    await syncLibraryQueries();
    if (provisionalAdded) {
      onDismissProvisionalItem(provisionalId);
    }
    if (!modalClosed) {
      onCloseModal();
    }

    if (pollOutcome.timedOut) {
      toast.info('Ingestion queued', {
        description: 'Document is taking longer than usual to process. It will appear once finished.',
        id: toastId,
      });
      return;
    }

    toast.success('Document imported', {
      description: finalTitle
        ? `"${finalTitle}" has been added to your library.`
        : 'Successfully added to your library.',
      id: toastId,
    });
  } catch (err: unknown) {
    if (provisionalAdded) {
      onDismissProvisionalItem(provisionalId);
    }
    toast.error('Import failed', {
      description: err instanceof Error ? err.message : 'Could not import reference.',
      id: toastId,
    });
  }
}

// ── Curation & Duplicates Queries ─────────────────────────────────────────────

export function useDuplicateGroups(scopeId?: string) {
  return useQuery({
    queryKey: curationKeys.duplicates(scopeId),
    queryFn: () => libraryServices.curation.getDuplicates(scopeId),
    enabled: true,
    gcTime: 3 * 60 * 1000,
  });
}

export function useMergeDuplicates(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: ({
      primaryItemId,
      duplicateItemIds,
      overrides,
    }: {
      primaryItemId: string;
      duplicateItemIds: string[];
      overrides?: Record<string, unknown>;
    }) => {
      return libraryServices.curation.mergeDuplicates(
        effectiveScope,
        primaryItemId,
        duplicateItemIds,
        overrides,
      );
    },
    onSuccess: (response: Awaited<ReturnType<typeof libraryServices.curation.mergeDuplicates>>) => {
      queryClient.invalidateQueries({ queryKey: curationKeys.duplicates(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: curationKeys.integrity(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      const count = response.mergedCount ?? 1;
      toast.success('Duplicates merged', {
        description: `Consolidated ${count} duplicate record(s) into master. Notes and citations preserved.`,
        id: 'library-merge',
      });
    },
    onError: (error: Error) => {
      toast.error('Merge failed', {
        description: error.message || 'Unable to consolidate duplicate records.',
        id: 'library-merge',
      });
    },
  });
}

export function useFetchAcademicFeed() {
  return useMutation({
    mutationFn: (url: string) => libraryServices.ingestion.fetchFeed(url),
    onError: (error: Error) => {
      toast.error('Failed to fetch feed', {
        description: error.message || 'Could not load feed from URL.',
        id: 'feed-fetch',
      });
    },
  });
}

export function usePreviewCaptureUrlMutation(scopeId?: string) {
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: (urlOrInput: string | { url: string; scopeId?: string }) => {
      const targetUrl = typeof urlOrInput === 'string' ? urlOrInput : urlOrInput.url;
      const targetScope =
        typeof urlOrInput === 'object' && urlOrInput.scopeId
          ? normalizeScopeId(urlOrInput.scopeId)
          : effectiveScope;
      return libraryServices.ingestion.captureUrl(targetScope, targetUrl);
    },
    onError: (error: Error) => {
      toast.error('Failed to preview URL', {
        description: error.message || 'Could not extract metadata from URL.',
        id: 'capture-url-preview',
      });
    },
  });
}

export interface ConfirmCaptureUrlInput {
  url: string;
  previewToken?: string;
  title?: string;
  abstract?: string;
  doi?: string;
  year?: number;
  publicationTitle?: string;
  itemType?: string;
  collectionId?: string;
  scopeId?: string;
}

export function useConfirmCaptureUrlMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: (payload: ConfirmCaptureUrlInput) => {
      const { scopeId: overrideScope, ...confirmPayload } = payload;
      const targetScope = overrideScope ? normalizeScopeId(overrideScope) : effectiveScope;
      return libraryServices.ingestion.confirmUrl(targetScope, confirmPayload);
    },
    onSuccess: (_data, variables) => {
      const targetScope = variables.scopeId ? normalizeScopeId(variables.scopeId) : effectiveScope;
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.counts(targetScope) });
      if (variables.collectionId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(targetScope, variables.collectionId),
        });
      }
      invalidateCollections(queryClient, targetScope);
    },
    onError: (error: Error) => {
      toast.error('Failed to save captured URL', {
        description: error.message || 'Could not confirm URL import.',
        id: 'capture-url-confirm',
      });
    },
  });
}

export function useIngestMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: (payload: UnifiedIngestionPayload) =>
      libraryServices.ingestion.ingest(effectiveScope, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) });
      const colId = (variables as { collectionId?: string })?.collectionId;
      if (colId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(effectiveScope, colId),
        });
      }
      invalidateCollections(queryClient, effectiveScope);
    },
  });
}

export function useDismissDuplicatesMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: (itemIds: string[]) =>
      libraryServices.curation.dismissDuplicates(effectiveScope, itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: curationKeys.duplicates(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
    },
  });
}

// ── Retraction Queries ────────────────────────────────────────────────────────

export const invalidateRetraction = (qc: QueryClient, scopeId?: string) => {
  const effectiveScope = normalizeScopeId(scopeId);
  qc.invalidateQueries({ queryKey: retractionKeys.all(effectiveScope) });
  qc.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
  qc.invalidateQueries({ queryKey: itemKeys.counts(effectiveScope) });
};

/**
 * Lean read-only hook for consumers that only need the retracted item list
 * (e.g. the editor linter and citation picker), without stats or mutations.
 */
export function useRetractedItems(scopeId?: string, enabled = true) {
  const effectiveScope = normalizeScopeId(scopeId);
  return useQuery({
    queryKey: retractionKeys.items(effectiveScope),
    queryFn: () => libraryServices.retraction.getRetractedItems(effectiveScope),
    enabled,
    staleTime: 1000 * 60 * 60,
  });
}

export function useRetraction(scopeId?: string, options?: { includeItems?: boolean }) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  const statsQuery = useQuery({
    queryKey: retractionKeys.stats(effectiveScope),
    queryFn: () => libraryServices.retraction.getStats(effectiveScope),
    enabled: true,
    staleTime: 1000 * 60 * 60,
  });

  const itemsQuery = useRetractedItems(
    effectiveScope,
    (options?.includeItems ?? true) && Boolean(effectiveScope),
  );

  const checkItemMutation = useMutation({
    mutationFn: (itemId: string) => libraryServices.retraction.checkItem(effectiveScope, itemId),
    onSuccess: (data) => {
      invalidateRetraction(queryClient, scopeId);
      if (data.status === 'unknown') {
        toast.info('Could not verify this item', {
          description:
            'Retraction status needs a DOI or PMID, or the lookup was unavailable. The stored status was not changed.',
          id: 'retraction-check',
        });
      } else if (data.isRetracted) {
        toast.error('Retraction detected!', {
          description: `This publication was flagged as ${data.nature || 'retracted'}.`,
          id: 'retraction-check',
        });
      } else {
        toast.success('Retraction check complete', {
          description: 'No retraction notices found for this item.',
          id: 'retraction-check',
        });
      }
    },
    onError: (err: Error) => {
      toast.error('Check failed', { description: err.message, id: 'retraction-check' });
    },
  });

  const checkLibraryMutation = useMutation({
    mutationFn: (itemIds?: string[]) => libraryServices.retraction.checkLibrary(effectiveScope, itemIds),
    onSuccess: (res) => {
      invalidateRetraction(queryClient, scopeId);
      if (res.newlyRetracted > 0) {
        toast.warning(`Scan completed: ${res.newlyRetracted} retracted item(s) found!`, {
          description: `Scanned ${res.scanned} publications in this library.`,
          id: 'retraction-scan',
        });
      } else {
        toast.success(`Scan completed: All ${res.scanned} publications clear`, {
          description: 'No new retracted items detected.',
          id: 'retraction-scan',
        });
      }
    },
    onError: (err: Error) => {
      toast.error('Library scan failed', { description: err.message, id: 'retraction-scan' });
    },
  });

  const flagMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: FlagRetractionInput }) =>
      libraryServices.retraction.flagItem(effectiveScope, itemId, data),
    onSuccess: () => {
      invalidateRetraction(queryClient, scopeId);
      toast.warning('Item flagged as retracted', { id: 'retraction-flag' });
    },
    onError: (err: Error) => {
      toast.error('Failed to flag item', { description: err.message, id: 'retraction-flag' });
    },
  });

  const unflagMutation = useMutation({
    mutationFn: (itemId: string) => libraryServices.retraction.unflagItem(effectiveScope, itemId),
    onSuccess: () => {
      invalidateRetraction(queryClient, scopeId);
      toast.success('Retraction flag removed', { id: 'retraction-flag' });
    },
    onError: (err: Error) => {
      toast.error('Failed to remove flag', { description: err.message, id: 'retraction-flag' });
    },
  });

  return {
    stats: statsQuery.data,
    retractedItems: itemsQuery.data || [],
    isLoadingStats: statsQuery.isLoading,
    isLoadingItems: itemsQuery.isLoading,
    checkItem: checkItemMutation.mutateAsync,
    checkLibrary: checkLibraryMutation.mutateAsync,
    flagItem: flagMutation.mutateAsync,
    unflagItem: unflagMutation.mutateAsync,
    isCheckingItem: checkItemMutation.isPending,
    isCheckingLibrary: checkLibraryMutation.isPending,
    isFlagging: flagMutation.isPending,
    isUnflagging: unflagMutation.isPending,
  };
}

