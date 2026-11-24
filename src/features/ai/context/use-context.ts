'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  getRagDocumentId,
  sourceEntryToAttachedPayload,
  sourcesToAttachments,
  type SourceEntry,
  type SourceType,
} from './source.port';
import { useFileUpload } from './upload';

const STORAGE_KEY_WEB_SITES = 'flux_web_search_sites';
const DEFAULT_WEB_SITES = [
  'arxiv.org',
  'biorxiv.org',
  'medrxiv.org',
  'nature.com',
  'science.org',
  'ieee.org',
];

function readSavedWebSites(): string[] {
  if (typeof window === 'undefined') return DEFAULT_WEB_SITES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_WEB_SITES);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((x): x is string => typeof x === 'string');
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_WEB_SITES;
}

export interface UseTurnContextOptions {
  spaceId?: string | null;
  initialSources?: SourceEntry[];
}

export function useTurnContext({
  spaceId = null,
  initialSources = [],
}: UseTurnContextOptions = {}) {
  const [sources, setSources] = useState<SourceEntry[]>(initialSources);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [webSearchSites, setWebSearchSitesState] = useState<string[]>(
    readSavedWebSites,
  );

  const { uploadingFiles, isUploading, uploadFiles } = useFileUpload(spaceId);

  const enabledDocumentIds = useMemo(
    () =>
      sources
        .filter((s) => s.enabled)
        .map(getRagDocumentId)
        .filter((id): id is string => Boolean(id)),
    [sources],
  );

  const attachedSources = useMemo(
    () =>
      sources.filter((s) => s.enabled).map(sourceEntryToAttachedPayload),
    [sources],
  );

  const attachments = useMemo(() => sourcesToAttachments(sources), [sources]);

  const addSources = useCallback(
    (
      entries: Array<
        Pick<SourceEntry, 'id' | 'name'> & {
          size?: number;
          sourceType?: SourceType;
          enabled?: boolean;
          itemId?: string;
          fileId?: string;
          ragDocId?: string;
          hasPdf?: boolean;
          indexed?: boolean;
        }
      >,
    ) => {
      if (!entries.length) return;
      setSources((prev) => {
        const next = [...prev];
        for (const item of entries) {
          if (!item.id) continue;
          const idx = next.findIndex((s) => s.id === item.id);
          if (idx === -1) {
            next.push({
              id: item.id,
              name: item.name || item.id,
              size: item.size,
              sourceType: item.sourceType ?? 'upload',
              enabled: item.enabled ?? true,
              ...(item.itemId ? { itemId: item.itemId } : {}),
              ...(item.fileId ? { fileId: item.fileId } : {}),
              ...(item.ragDocId ? { ragDocId: item.ragDocId } : {}),
              ...(item.hasPdf !== undefined ? { hasPdf: item.hasPdf } : {}),
              ...(item.indexed !== undefined ? { indexed: item.indexed } : {}),
            });
          } else {
            next[idx] = {
              ...next[idx],
              name:
                next[idx].name === next[idx].id && item.name
                  ? item.name
                  : next[idx].name,
              size: item.size ?? next[idx].size,
              sourceType: item.sourceType ?? next[idx].sourceType,
              itemId: item.itemId ?? next[idx].itemId,
              fileId: item.fileId ?? next[idx].fileId,
              ragDocId: item.ragDocId ?? next[idx].ragDocId,
              hasPdf: item.hasPdf ?? next[idx].hasPdf,
              indexed: item.indexed ?? next[idx].indexed,
            };
          }
        }
        return next;
      });
    },
    [],
  );

  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const toggleSource = useCallback((id: string) => {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
  }, []);

  const clearSources = useCallback(() => {
    setSources([]);
  }, []);

  const handleUploadFiles = useCallback(
    async (files: File[], overrideSpaceId?: string | null) => {
      const uploaded = await uploadFiles(files, overrideSpaceId);
      if (uploaded.length > 0) {
        addSources(uploaded);
      }
      return uploaded;
    },
    [uploadFiles, addSources],
  );

  const setWebSearchSites = useCallback((sites: string[]) => {
    setWebSearchSitesState(sites);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY_WEB_SITES, JSON.stringify(sites));
      } catch {
        // Ignore storage write errors
      }
    }
  }, []);

  return {
    sources,
    enabledDocumentIds,
    attachedSources,
    attachments,
    uploadingFiles,
    isUploading,
    webSearchEnabled,
    setWebSearchEnabled,
    webSearchSites,
    setWebSearchSites,
    addSources,
    removeSource,
    toggleSource,
    clearSources,
    uploadFiles: handleUploadFiles,
  };
}
