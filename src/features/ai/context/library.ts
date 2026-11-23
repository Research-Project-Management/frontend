'use client';

import { useMemo } from 'react';
import {
  buildCollectionTree,
  type TreeNode,
} from '@/features/library/domain/collection-tree';
import { isProjectScope } from '@/features/library/domain/identifiers';
import { ItemsService } from '@/features/library/sdk/clients/items.client';
import { useItems } from '@/features/library/sdk/queries/catalog.queries';
import { useCollections } from '@/features/library/sdk/queries/collections.queries';
import type { Item } from '@/features/library/types/core.types';
import { normalizeSpaceId } from '../transport/flux';
import type {
  LibraryReadiness,
  SourceAdapter,
  SourceEntry,
} from './source.port';

export interface ItemRagInfo {
  ragStatus?: string;
  ragDocId?: string;
  isIndexed: boolean;
}

export interface LibraryFileInfo extends ItemRagInfo {
  fileId?: string;
  hasPdf: boolean;
  fileSize?: number;
  readiness: LibraryReadiness;
}

export interface LibraryCollectionNode {
  id: string;
  name: string;
  children: LibraryCollectionNode[];
}

export interface LibraryPaperEntry {
  itemId: string;
  title: string;
  subtitle?: string;
  readiness: LibraryReadiness;
  year?: number | null;
  doi?: string;
  tags: string[];
  entry: SourceEntry;
}

export type LibraryPaperFilter = 'all' | 'pdf' | 'indexed';

export interface LibraryPaperCounts {
  all: number;
  pdf: number;
  indexed: number;
}

function cleanStr(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readRagFieldsFromRecord(record: unknown): ItemRagInfo {
  if (!record || typeof record !== 'object') {
    return { isIndexed: false };
  }
  const obj = record as {
    ragStatus?: unknown;
    ragDocId?: unknown;
    metadata?: unknown;
  };
  const meta =
    obj.metadata && typeof obj.metadata === 'object'
      ? (obj.metadata as Record<string, unknown>)
      : undefined;

  const ragStatus = cleanStr(meta?.ragStatus) ?? cleanStr(obj.ragStatus);
  const ragDocId = cleanStr(meta?.ragDocId) ?? cleanStr(obj.ragDocId);
  return {
    ragStatus,
    ragDocId,
    isIndexed: ragStatus === 'indexed' && Boolean(ragDocId),
  };
}

function isPdfAttachment(att: {
  attachmentType?: string;
  mimeType?: string;
  filename?: string;
}): boolean {
  const attType = (att.attachmentType || '').toLowerCase();
  if (attType === 'snapshot' || attType === 'web_snapshot') {
    return false;
  }
  const mime = (att.mimeType || '').toLowerCase();
  const name = (att.filename || '').toLowerCase();
  return mime.includes('pdf') || name.endsWith('.pdf');
}

function extractItemTags(item: Item): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  const pushTag = (raw: unknown) => {
    const cleaned = cleanStr(raw);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      tags.push(cleaned);
    }
  };

  if (Array.isArray(item.tags)) {
    for (const tag of item.tags) pushTag(tag);
  }
  if (Array.isArray(item.itemTags)) {
    for (const rel of item.itemTags) {
      pushTag(rel?.tag?.name ?? rel?.name);
    }
  }
  return tags;
}

function extractItemAuthors(item: Item): string[] {
  if (Array.isArray(item.authors) && item.authors.length > 0) {
    return item.authors.filter((a): a is string => Boolean(cleanStr(a)));
  }
  if (Array.isArray(item.contributors) && item.contributors.length > 0) {
    return item.contributors
      .map((c) => cleanStr(c.fullName) ?? cleanStr(c.name))
      .filter((name): name is string => Boolean(name));
  }
  if (cleanStr(item.firstAuthor)) {
    return [cleanStr(item.firstAuthor)!];
  }
  return [];
}

export function extractRagInfo(item: Item): ItemRagInfo {
  const direct = readRagFieldsFromRecord(item);
  if (direct.isIndexed && direct.ragDocId) {
    return direct;
  }
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];
  for (const att of attachments) {
    if (!isPdfAttachment(att)) continue;
    const fromAtt = readRagFieldsFromRecord(att);
    if (fromAtt.isIndexed && fromAtt.ragDocId) {
      return fromAtt;
    }
  }
  return direct;
}

export function extractLibraryFileInfo(item: Item): LibraryFileInfo {
  const rag = extractRagInfo(item);
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];

  const pdfWithFile =
    attachments.find(
      (a) => cleanStr(a.fileId) && a.attachmentType === 'primary_pdf',
    ) ??
    attachments.find(
      (a) => cleanStr(a.fileId) && a.isPrimary && isPdfAttachment(a),
    ) ??
    attachments.find((a) => cleanStr(a.fileId) && isPdfAttachment(a)) ??
    attachments.find(
      (a) =>
        cleanStr(a.fileId) &&
        a.attachmentType !== 'snapshot' &&
        a.attachmentType !== 'web_snapshot',
    );

  const fileId =
    cleanStr(item.primaryFile?.fileId) ??
    cleanStr(item.fileId) ??
    cleanStr(pdfWithFile?.fileId);

  const hasPdf = Boolean(fileId);
  const fileSize =
    item.primaryFile?.size ??
    (typeof pdfWithFile?.size === 'number' ? pdfWithFile.size : undefined) ??
    item.size;

  const readiness: LibraryReadiness = rag.isIndexed
    ? 'indexed'
    : hasPdf
      ? 'pdf'
      : 'metadata';

  return {
    ...rag,
    fileId,
    hasPdf,
    fileSize,
    readiness,
  };
}

export const librarySourceAdapter: SourceAdapter<Item> = {
  type: 'library',
  toSourceEntry(item) {
    if (!item?.id) return null;
    const info = extractLibraryFileInfo(item);
    return {
      id: item.id,
      name: item.title || 'Untitled Document',
      size: info.fileSize,
      enabled: true,
      sourceType: 'library',
      itemId: item.id,
      fileId: info.fileId,
      ragDocId: info.ragDocId,
      hasPdf: info.hasPdf,
      indexed: info.isIndexed,
    };
  },
};

function mapCollectionTree(nodes: TreeNode[]): LibraryCollectionNode[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    children: mapCollectionTree(node.children),
  }));
}

export interface UseLibraryContextItemsOptions {
  spaceId?: string | null;
  collectionId?: string;
  search?: string;
  filter?: LibraryPaperFilter;
  enabled?: boolean;
}

export function useLibraryContextItems({
  spaceId,
  collectionId,
  search = '',
  filter = 'all',
  enabled = true,
}: UseLibraryContextItemsOptions) {
  const libraryScope = spaceId && isProjectScope(spaceId) ? spaceId : 'user';

  const { collections } = useCollections({
    spaceId: libraryScope,
    enabled,
  });

  const {
    collectionItems,
    items: allLibraryItems,
    isLoadingCollection,
    isLoadingAll,
  } = useItems({
    spaceId: libraryScope,
    collectionId,
    enabled: enabled ? undefined : false,
  });

  const tree = useMemo(
    () => mapCollectionTree(buildCollectionTree(collections)),
    [collections],
  );

  const { papers, counts } = useMemo<{
    papers: LibraryPaperEntry[];
    counts: LibraryPaperCounts;
  }>(() => {
    const raw: Item[] = collectionId
      ? Array.isArray(collectionItems)
        ? collectionItems
        : []
      : (allLibraryItems ?? []);

    const q = search.trim().toLowerCase();
    const matched: LibraryPaperEntry[] = [];
    let pdfCount = 0;
    let indexedCount = 0;

    for (const item of raw) {
      const entry = librarySourceAdapter.toSourceEntry(item);
      if (!entry) continue;

      const authors = extractItemAuthors(item);
      const tags = extractItemTags(item);
      const doi = cleanStr(item.doi) ?? cleanStr(item.DOI);
      const year = typeof item.year === 'number' ? item.year : null;

      if (q) {
        const haystack = [
          item.title || '',
          authors.join(' '),
          year ? String(year) : '',
          doi || '',
          tags.join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) {
          continue;
        }
      }

      const readiness: LibraryReadiness = entry.indexed
        ? 'indexed'
        : entry.hasPdf
          ? 'pdf'
          : 'metadata';

      if (readiness === 'indexed') {
        indexedCount += 1;
        pdfCount += 1;
      } else if (readiness === 'pdf') {
        pdfCount += 1;
      }

      const authorPart = authors.length > 0 ? authors.slice(0, 2).join(', ') : '';
      const yearPart = year ? ` (${year})` : '';
      const subtitle = authorPart
        ? `${authorPart}${yearPart}`
        : year
          ? String(year)
          : undefined;

      matched.push({
        itemId: item.id,
        title: item.title || entry.name,
        subtitle,
        readiness,
        year,
        doi,
        tags,
        entry,
      });
    }

    const filtered =
      filter === 'indexed'
        ? matched.filter((p) => p.readiness === 'indexed')
        : filter === 'pdf'
          ? matched.filter(
              (p) => p.readiness === 'indexed' || p.readiness === 'pdf',
            )
          : matched;

    return {
      papers: filtered,
      counts: {
        all: matched.length,
        pdf: pdfCount,
        indexed: indexedCount,
      },
    };
  }, [collectionId, collectionItems, allLibraryItems, search, filter]);

  return {
    tree,
    papers,
    counts,
    isLoading: collectionId ? isLoadingCollection : isLoadingAll,
  };
}

export async function loadCollectionSources(
  collectionId: string,
  spaceId?: string | null,
  options?: { maxItems?: number },
): Promise<SourceEntry[]> {
  const maxItems = Math.max(1, options?.maxItems ?? 20);
  const targetScope = normalizeSpaceId(spaceId) ?? 'user';
  const res = await ItemsService.getByCollection(targetScope, collectionId);
  const resObj = res as unknown as Item[] | { papers?: Item[]; items?: Item[] };
  const papers: Item[] = Array.isArray(resObj)
    ? resObj
    : (resObj?.papers ?? resObj?.items ?? []);

  const entries: SourceEntry[] = [];
  for (const paper of papers) {
    const entry = librarySourceAdapter.toSourceEntry(paper);
    if (!entry) continue;
    entries.push(entry);
    if (entries.length >= maxItems) break;
  }
  return entries;
}
