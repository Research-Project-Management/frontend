import {
  type UnifiedIngestionPayload,
  type UnifiedIngestionResponse,
  type IngestionRunSnapshotResponse,
  UnifiedIngestionPayloadSchema,
  UnifiedIngestionResponseSchema,
  IngestionRunSnapshotResponseSchema,
} from '@/features/library/types/core.types';
import {
  resolveFeedVirtualizationPlan,
  mapOpenAlexWorksToFeedEntries,
  mapCrossRefWorksToFeedEntries,
  mapEuropePmcWorksToFeedEntries,
  type FeedEntryApiItem,
} from '@/features/library/domain/feed-parser';
import {
  libraryClient,
  isProjectScope,
  getIngestionUrl,
  toIngestionSubmission,
} from './http.client';

const CLIENT_FEED_CACHE_PREFIX = 'flux:feed-cache:v1:';
const CLIENT_FEED_TTL_MS = 60 * 60 * 1000; // 60 minutes local SWR freshness window

interface CachedBrowserFeedSnapshot {
  feedTitle: string;
  entries: FeedEntryApiItem[];
  fetchedAt: number;
}

function readBrowserFeedSnapshot(feedUrl: string): CachedBrowserFeedSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(`${CLIENT_FEED_CACHE_PREFIX}${feedUrl.trim()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBrowserFeedSnapshot;
    if (
      parsed &&
      typeof parsed.fetchedAt === 'number' &&
      Array.isArray(parsed.entries) &&
      parsed.entries.length > 0
    ) {
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function writeBrowserFeedSnapshot(
  feedUrl: string,
  feedTitle: string,
  entries: FeedEntryApiItem[],
): void {
  if (typeof window === 'undefined' || !window.localStorage || entries.length === 0) return;
  try {
    const payload: CachedBrowserFeedSnapshot = {
      feedTitle,
      entries: entries.slice(0, 60),
      fetchedAt: Date.now(),
    };
    window.localStorage.setItem(
      `${CLIENT_FEED_CACHE_PREFIX}${feedUrl.trim()}`,
      JSON.stringify(payload),
    );
  } catch {
    // Quota exceeded or private browsing — non-fatal
  }
}

export const IngestionService = {
  ingest: async (
    spaceId: string | undefined,
    payload: UnifiedIngestionPayload,
    options?: { signal?: AbortSignal },
  ): Promise<UnifiedIngestionResponse> => {
    const validated = UnifiedIngestionPayloadSchema.parse(payload);
    const submission = {
      ...toIngestionSubmission(validated),
      ...(isProjectScope(spaceId) ? { spaceId: spaceId } : {}),
    };
    const res = await libraryClient.post<Record<string, unknown>>(
      getIngestionUrl(spaceId, 'submit'),
      submission,
      { timeout: 30000, signal: options?.signal },
    );
    const accepted = (res && typeof res === 'object' && 'data' in res && res.data ? res.data : res) as Record<string, unknown>;
    const rawItemId = accepted.existingItemId ?? accepted.itemId;
    return UnifiedIngestionResponseSchema.parse({
      success: true,
      data: {
        runId: accepted.runId,
        status: accepted.status,
        itemId: typeof rawItemId === 'string' && rawItemId ? rawItemId : undefined,
        deduplicated: accepted.deduplicated,
      },
    });
  },

  getRunStatus: async (spaceId: string | undefined, runId: string): Promise<IngestionRunSnapshotResponse> => {
    const res = await libraryClient.get<Record<string, unknown>>(
      getIngestionUrl(spaceId, `runs/${encodeURIComponent(runId)}`),
    );
    const enveloped = res && typeof res === 'object' && 'data' in res ? res : { success: true, data: res };
    return IngestionRunSnapshotResponseSchema.parse(enveloped);
  },

  getRunProgress: async (spaceId: string | undefined, runId: string) => {
    const res = await libraryClient.get<{ data?: unknown } | unknown>(
      getIngestionUrl(spaceId, `status/${encodeURIComponent(runId)}/progress`),
    );
    return (res && typeof res === 'object' && 'data' in res && res.data ? res.data : res) as import('@/features/library/types/ingestion.types').IngestionProgressResponse;
  },

  fetchFeed: async (
    url: string,
    forceRefresh = false,
  ): Promise<{
    feedTitle: string;
    entries: FeedEntryApiItem[];
  }> => {
    const trimmedUrl = (url || '').trim();
    if (!trimmedUrl) {
      return { feedTitle: 'Academic Feed', entries: [] };
    }

    // 1. Check Local-First Browser Snapshot (SWR 60-min Freshness Window)
    const cached = readBrowserFeedSnapshot(trimmedUrl);
    if (
      !forceRefresh &&
      cached &&
      Date.now() - cached.fetchedAt < CLIENT_FEED_TTL_MS
    ) {
      return {
        feedTitle: cached.feedTitle,
        entries: cached.entries,
      };
    }

    // 2. Client-Side Protocol Virtualization (Direct CORS Fetch from User's Browser IP)
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      const plan = resolveFeedVirtualizationPlan(trimmedUrl, 30);
      if (plan.kind !== 'server-fallback') {
        try {
          const response = await window.fetch(plan.endpointUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal:
              typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
                ? AbortSignal.timeout(8_000)
                : undefined,
          });
          if (response.ok) {
            const json: unknown = await response.json();
            let virtualizedEntries: FeedEntryApiItem[] = [];
            if (plan.kind === 'openalex') {
              virtualizedEntries = mapOpenAlexWorksToFeedEntries(
                json,
                plan.primaryCategory,
              );
            } else if (plan.kind === 'crossref') {
              virtualizedEntries = mapCrossRefWorksToFeedEntries(
                json,
                plan.feedTitle,
                plan.primaryCategory,
              );
            } else if (plan.kind === 'europepmc') {
              virtualizedEntries = mapEuropePmcWorksToFeedEntries(json);
            }
            if (virtualizedEntries.length > 0) {
              writeBrowserFeedSnapshot(
                trimmedUrl,
                plan.feedTitle,
                virtualizedEntries,
              );
              return {
                feedTitle: plan.feedTitle,
                entries: virtualizedEntries,
              };
            }
          }
        } catch {
          // If client-side CORS fetch fails (e.g. strict corporate firewall), gracefully fall through
        }
      }
    }

    // 3. Server Fallback (for generic RSS/Atom blogs or when client CORS is unreachable)
    try {
      const res = await libraryClient.post<{
        feedTitle?: string;
        entries?: FeedEntryApiItem[];
        data?: {
          feedTitle?: string;
          entries?: FeedEntryApiItem[];
        };
      }>(getIngestionUrl(undefined, 'fetch-feed'), {
        url: trimmedUrl,
        forceRefresh,
      });
      const payload =
        res && typeof res === 'object' && 'data' in res && res.data
          ? res.data
          : res;
      const result = {
        feedTitle: payload?.feedTitle || cached?.feedTitle || 'Academic Feed',
        entries: Array.isArray(payload?.entries) ? payload.entries : [],
      };
      if (result.entries.length > 0) {
        writeBrowserFeedSnapshot(trimmedUrl, result.feedTitle, result.entries);
      }
      return result;
    } catch (err) {
      // Stale-if-Error: return stale browser snapshot if server is also unreachable
      if (cached && cached.entries.length > 0) {
        return {
          feedTitle: cached.feedTitle,
          entries: cached.entries,
        };
      }
      throw err;
    }
  },
};
