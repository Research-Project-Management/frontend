'use client';

import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { libraryServices, IngestionService } from '../library.client';
import type { UnifiedIngestionPayload } from '@/features/library/domain/types/library.types';
import { itemKeys, invalidateCollections } from '@/features/library/sdk/query-keys';
import {
  cleanDoi,
  extractArxivId,
  extractPmid,
  extractPmcId,
  cleanIsbn,
} from '@/features/library/domain/identifiers';
import { ClientMetadataResolverService } from '@/features/library/core/services/client-metadata-resolver.service';

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
  adaptiveBackoff?: boolean;
}

export function computeNextPollDelayMs(
  baseIntervalMs: number,
  attempt: number,
  adaptiveBackoff: boolean,
): number {
  if (!adaptiveBackoff || attempt < 3) {
    return baseIntervalMs;
  }
  const maxIntervalMs = Math.max(baseIntervalMs, 4000);
  const multiplier = Math.min(3.5, Math.pow(1.35, attempt - 2));
  const rawDelay = Math.min(maxIntervalMs, Math.round(baseIntervalMs * multiplier));
  const jitterFactor = 0.9 + Math.random() * 0.2;
  return Math.max(baseIntervalMs, Math.round(rawDelay * jitterFactor));
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
  const useAdaptiveBackoff =
    opts.adaptiveBackoff ?? opts.pollIntervalMs === undefined;
  let finalTitle = opts.fallbackTitle;
  let finalItemId = opts.initialItemId;
  let slowThresholdTriggered = false;
  let attempt = 0;

  while (Date.now() - startTime < maxWaitMs) {
    if (opts.signal?.aborted) {
      return { ok: false, error: 'Polling aborted' };
    }
    const nextDelayMs = computeNextPollDelayMs(
      pollIntervalMs,
      attempt,
      useAdaptiveBackoff,
    );
    attempt++;
    await abortableSleep(nextDelayMs, opts.signal);
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
          resolutionStatus?: string;
          title?: string;
          itemId?: string;
          lastError?: string;
          errorMessage?: string;
        };
        status?: string;
        resolutionStatus?: string;
        title?: string;
        itemId?: string;
        lastError?: string;
        errorMessage?: string;
      } | null;
      const currentRun = statusPayload?.data || statusPayload;
      const currentStatus = (currentRun?.status || '').toUpperCase();
      const currentResolutionStatus = (currentRun?.resolutionStatus || '').toUpperCase();

      if (
        currentStatus === 'COMPLETED' ||
        currentStatus === 'READY' ||
        currentStatus === 'SUCCEEDED' ||
        currentRun?.resolutionStatus === 'NEEDS_REVIEW' ||
        currentResolutionStatus === 'NEEDS_REVIEW' ||
        currentStatus === 'NEEDS_REVIEW'
      ) {
        if (currentRun?.title && currentRun.title !== 'Uploaded Document') {
          finalTitle = currentRun.title;
        }
        if (currentRun?.itemId) {
          finalItemId = currentRun.itemId;
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
          error: currentRun?.lastError || currentRun?.errorMessage || 'Extraction failed',
        };
      }
    } catch (err: unknown) {
      const errObj = err as { status?: number; statusCode?: number; response?: { status?: number } } | null;
      const status = errObj?.status ?? errObj?.statusCode ?? errObj?.response?.status;
      if (status === 401 || status === 403 || status === 404) {
        throw err;
      }
      // Retry on transient poll network glitch
    }
  }

  // Non-blocking graceful handoff: file was safely stored and queued on server
  return { ok: true, timedOut: true, title: finalTitle, itemId: finalItemId };
}

// ── Identifier / Link Ingestion & Polling Orchestration ───────────────────────

export function buildIdentifierIngestionPayload(
  rawInput: string,
  options?: {
    collectionId?: string;
    title?: string;
    attachOaPdf?: boolean;
    saveSnapshot?: boolean;
  },
): UnifiedIngestionPayload {
  const raw = rawInput.trim();
  const targetCollectionId = options?.collectionId || undefined;
  const userTitle = options?.title?.trim() || undefined;
  const overridesObj: Record<string, unknown> = {
    ...(userTitle ? { title: userTitle } : {}),
    ...(options?.attachOaPdf !== undefined ? { attachOaPdf: options.attachOaPdf } : {}),
    ...(options?.saveSnapshot !== undefined ? { saveSnapshot: options.saveSnapshot } : {}),
  };
  const overrides = Object.keys(overridesObj).length > 0 ? overridesObj : undefined;

  if (
    raw.startsWith('@') ||
    /^(?:%[^\r\n]*[\r\n]+\s*)*@[a-zA-Z]+\s*\{/.test(raw)
  ) {
    return {
      source: 'bibtex',
      content: raw,
      collectionId: targetCollectionId,
      ...(overrides ? { overrides } : {}),
    } as UnifiedIngestionPayload;
  }
  if (raw.startsWith('TY  -') || /^(?:\uFEFF)?\s*TY\s+-/m.test(raw)) {
    return {
      source: 'ris',
      content: raw,
      collectionId: targetCollectionId,
      ...(overrides ? { overrides } : {}),
    } as UnifiedIngestionPayload;
  }
  if (
    (raw.startsWith('[') && raw.endsWith(']')) ||
    (raw.startsWith('{') && raw.endsWith('}') && /"(?:title|type|author|DOI|issued)"/i.test(raw))
  ) {
    return {
      source: 'csl_json',
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

  // 2. Check PubMed URL, PMID, or PMCID string
  const pmcCandidate = extractPmcId(raw);
  if (pmcCandidate) {
    return { source: 'pmid', pmid: pmcCandidate, collectionId: targetCollectionId, overrides };
  }
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
  attachOaPdf?: boolean;
  saveSnapshot?: boolean;
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
  attachOaPdf,
  saveSnapshot,
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

  // Tier 2: Attempt Client-Assisted Ingestion via User Browser IP
  let ingestionPayload: UnifiedIngestionPayload;
  let resolvedDisplayTitle = userTitle || raw;

  try {
    const clientRes = await ClientMetadataResolverService.resolveIdentifier(raw);
    if (clientRes?.success && clientRes.cslJson) {
      if (clientRes.title && !userTitle) {
        resolvedDisplayTitle = clientRes.title;
      }
      ingestionPayload = {
        source: 'csl_json',
        content: JSON.stringify(clientRes.cslJson),
        collectionId: targetCollectionId,
        overrides: {
          ...(userTitle ? { title: userTitle } : clientRes.title ? { title: clientRes.title } : {}),
          doi: clientRes.doi,
          pmid: clientRes.pmid,
          resolutionSource: 'client',
          primaryProvider: clientRes.provider,
          ...(attachOaPdf !== undefined ? { attachOaPdf } : {}),
          ...(saveSnapshot !== undefined ? { saveSnapshot } : {}),
        },
      } as UnifiedIngestionPayload;
    } else {
      // Tier 3 Fallback: Standard identifier resolution on server
      ingestionPayload = buildIdentifierIngestionPayload(raw, {
        collectionId: targetCollectionId,
        title: userTitle,
        attachOaPdf,
        saveSnapshot,
      });
    }
  } catch {
    // Tier 3 Fallback on any client exception
    ingestionPayload = buildIdentifierIngestionPayload(raw, {
      collectionId: targetCollectionId,
      title: userTitle,
      attachOaPdf,
      saveSnapshot,
    });
  }

  const provisionalId = `provisional-link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const toastId = `add-identifier-${provisionalId}`;
  toast.loading(`Adding ${resolvedDisplayTitle ? `"${resolvedDisplayTitle}"` : 'reference'}...`, { id: toastId });
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
    let handedOffToBackground = false;
    const pollOutcome = await pollIngestionRunCompletion(scopeId, runId, {
      fallbackTitle: finalTitle,
      pollIntervalMs: 700,
      maxWaitMs: 60000,
      slowPollThresholdMs: 3500,
      onSlowPollThreshold: () => {
        handedOffToBackground = true;
        if (!modalClosed) {
          modalClosed = true;
          onCloseModal();
        }
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
    if (!handedOffToBackground && !modalClosed) {
      modalClosed = true;
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
