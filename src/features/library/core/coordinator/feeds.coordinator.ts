'use client';

import { toast } from 'sonner';
import { pollIngestionRunCompletion } from '@/features/library/sdk/queries/ingestion.queries';
import {
  mapFeedEntryToCreateItemPayload,
  type ParsedFeedEntry,
} from '@/features/library/domain/feed-parser';
import type {
  AddFeedFormValues,
  Collection,
  UnifiedIngestionPayload,
} from '@/features/library/types/core.types';
import type {
  FeedRetentionDays,
  SavedFeedSubscription,
} from '@/features/library/types/ingestion.types';

async function executeSaveFeedEntryToLibrary<TCreatePayload extends Record<string, unknown>>(params: {
  entry: ParsedFeedEntry;
  spaceId: string;
  targetCollectionId?: string;
  createItem: (payload: TCreatePayload) => Promise<unknown>;
  ingestItem?: (
    payload:
      | {
          source: 'doi';
          doi: string;
          collectionId?: string;
          overrides?: Record<string, unknown>;
        }
      | {
          source: 'arxiv';
          arxivId: string;
          collectionId?: string;
          overrides?: Record<string, unknown>;
        },
  ) => Promise<unknown>;
}): Promise<void> {
  const { entry, spaceId, targetCollectionId, createItem, ingestItem } = params;
  const createPayload = mapFeedEntryToCreateItemPayload(entry, {
    spaceId,
    collectionId: targetCollectionId,
  });

  let savedViaPipeline = false;
  let pipelineRunCreated = false;
  if (ingestItem && (entry.doi || entry.arxivId)) {
    try {
      const ingestRes = await ingestItem({
        ...(entry.doi
          ? { source: 'doi' as const, doi: entry.doi }
          : { source: 'arxiv' as const, arxivId: entry.arxivId! }),
        collectionId: targetCollectionId,
        overrides: {
          title: entry.title,
          abstract: entry.abstract,
          publicationTitle: entry.publicationTitle,
          year: entry.year,
          url: createPayload.url,
          tags: entry.categories,
          attachOaPdf: true,
          saveSnapshot: false,
        },
      });
      const resObj = (ingestRes ?? {}) as {
        data?: { runId?: string; status?: string };
        runId?: string;
        status?: string;
        _polled?: boolean;
      };
      const runId = resObj.data?.runId || resObj.runId;
      if (runId) {
        pipelineRunCreated = true;
      }
      const initialStatus = String(
        resObj.data?.status || resObj.status || '',
      ).toUpperCase();
      const isAlreadyDone =
        resObj._polled === true ||
        initialStatus === 'COMPLETED' ||
        initialStatus === 'READY' ||
        initialStatus === 'PARTIAL' ||
        initialStatus === 'DUPLICATE';
      if (runId && !isAlreadyDone) {
        const outcome = await pollIngestionRunCompletion(spaceId, runId);
        savedViaPipeline =
          outcome.status !== 'FAILED' && outcome.status !== 'BLOCKED';
      } else {
        savedViaPipeline = true;
      }
    } catch {
      savedViaPipeline = pipelineRunCreated;
    }
  }

  if (!savedViaPipeline) {
    await createItem({ ...createPayload, silent: true } as unknown as TCreatePayload);
  }
}

interface SaveFeedEntryCoordinatorOptions<
  TCreatePayload extends Record<string, unknown> = Record<string, unknown>,
> {
  entry: ParsedFeedEntry;
  spaceId: string;
  targetCollectionId?: string;
  createItem: (payload: TCreatePayload) => Promise<unknown>;
  ingestItem?: Parameters<typeof executeSaveFeedEntryToLibrary>[0]['ingestItem'];
  collections?: readonly Collection[];
  markEntryAsRead: (entryId: string) => void;
  setEntrySaving: (entryId: string, isSaving: boolean) => void;
  markEntrySaved: (entryId: string) => void;
}

/**
 * Shared coordinator workflow for saving an RSS/Atom feed entry into the user's or project's library.
 * Centralizes read marking, saving state tracking, collection toast notifications, and error handling.
 */
export async function saveFeedEntry<
  TCreatePayload extends Record<string, unknown> = Record<string, unknown>,
>({
  entry,
  spaceId,
  targetCollectionId,
  createItem,
  ingestItem,
  collections,
  markEntryAsRead,
  setEntrySaving,
  markEntrySaved,
}: SaveFeedEntryCoordinatorOptions<TCreatePayload>): Promise<void> {
  setEntrySaving(entry.id, true);
  try {
    await executeSaveFeedEntryToLibrary({
      entry,
      spaceId,
      targetCollectionId,
      createItem,
      ingestItem,
    });
    markEntryAsRead(entry.id);
    markEntrySaved(entry.id);

    const colName = targetCollectionId
      ? collections?.find((c) => c.id === targetCollectionId)?.name
      : undefined;

    toast.success(colName ? `Saved to "${colName}"` : 'Saved to Library', {
      description: `"${entry.title.slice(0, 48)}..." added to your collection.`,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Could not add feed item.';
    toast.error('Failed to save to library', { description: msg });
  } finally {
    setEntrySaving(entry.id, false);
  }
}

/**
 * Resolves the RSS/Atom feed title from a feed URL via `fetchAcademicFeed`.
 * Returns `undefined` when auto-detection fails or produces an empty string.
 */
export async function resolveFeedTitleFromUrl(
  url: string,
  fetchAcademicFeed: (params: { url: string; silent?: boolean }) => Promise<unknown>,
): Promise<string | undefined> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return undefined;
  try {
    const res = await fetchAcademicFeed({ url: trimmedUrl, silent: true });
    const payload =
      typeof res === 'object' && res !== null && 'data' in res
        ? (res as { data?: { feedTitle?: string } }).data
        : (res as { feedTitle?: string });
    const detected = payload?.feedTitle;
    if (detected && typeof detected === 'string' && detected.trim()) {
      return detected.trim();
    }
  } catch {
    // Background detection failure is non-fatal
  }
  return undefined;
}

/**
 * Shared coordinator workflow for subscribing to a new RSS/Atom feed with automatic title fallback.
 * Eliminates duplicate auto-title + subscribe orchestration across AddFeedModal, LibraryModals, and FeedsManagerModal.
 */
export async function subscribeFeedAutoTitle(params: {
  data: AddFeedFormValues;
  fetchAcademicFeed: (params: { url: string; silent?: boolean }) => Promise<unknown>;
  subscribeFeed: (payload: {
    name: string;
    url: string;
    retentionDays: FeedRetentionDays;
    cleanupReadAfter: FeedRetentionDays;
    cleanupUnreadAfter: FeedRetentionDays;
  }) => Promise<SavedFeedSubscription>;
}): Promise<SavedFeedSubscription> {
  const { data, fetchAcademicFeed, subscribeFeed } = params;
  let finalName = (data.name || '').trim();
  if (!finalName) {
    finalName = (await resolveFeedTitleFromUrl(data.url, fetchAcademicFeed)) || '';
  }

  const unreadDays = (data.cleanupUnreadAfter ?? data.retentionDays ?? 30) as FeedRetentionDays;
  const readDays = (data.cleanupReadAfter ?? 7) as FeedRetentionDays;

  return subscribeFeed({
    name: finalName || 'Academic Feed',
    url: data.url.trim(),
    retentionDays: unreadDays,
    cleanupReadAfter: readDays,
    cleanupUnreadAfter: unreadDays,
  });
}
