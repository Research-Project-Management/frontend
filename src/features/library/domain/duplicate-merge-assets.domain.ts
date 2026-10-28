import type { Item } from './types/library.types';
import { isValidValue, normalizeTags } from './metadata';
import {
  parseCreatorName,
  splitAuthorString,
  isInstitutionName,
} from './creators';
import { isFieldEmpty } from './diff-primitives';

export interface MergedItemPayload {
  masterId: string;
  sourceIds: string[];
  duplicateIds: string[];
  fieldSelections: Record<string, unknown>;
  resolvedFields: Record<string, unknown>;
  tags: string[];
  collectionIds: string[];
  attachments: unknown[];
  uniqueAttachmentCount: number;
  duplicateAttachmentCount: number;
  totalAnnotationCount: number;
}

export interface AggregatedAssetsSummary {
  totalFiles: number;
  fileList: unknown[];
  attachments: unknown[];
  uniqueAttachmentCount: number;
  duplicateAttachmentCount: number;
  totalAnnotationCount: number;
  totalNotes: number;
  noteCount: number;
  notes: unknown[];
  totalTags: number;
  tags: string[];
  totalCollections: number;
  collectionCount: number;
  collections: string[];
  combinedTags: string[];
  combinedCollectionIds: string[];
  attachmentCount: number;
  notesCount: number;
}

export type AggregatedAssetsResult = AggregatedAssetsSummary;

export function buildStructuredCreatorsFromAuthors(
  rawAuthors: unknown,
): Array<Record<string, unknown>> {
  if (isFieldEmpty(rawAuthors)) return [];
  const rawList = Array.isArray(rawAuthors)
    ? rawAuthors
    : typeof rawAuthors === 'string'
      ? splitAuthorString(rawAuthors)
      : [];
  const structured: Array<Record<string, unknown>> = [];
  rawList.forEach((entry, idx) => {
    if (!entry) return;
    if (typeof entry === 'string') {
      const parsed = parseCreatorName(entry);
      const fullName = (parsed.fullName || entry).trim();
      if (!fullName) return;
      structured.push({
        firstName: parsed.isInstitution ? '' : parsed.firstName || '',
        lastName: parsed.isInstitution ? fullName : parsed.lastName || fullName,
        fullName,
        fieldMode: parsed.isInstitution ? 1 : 0,
        creatorType: 'author',
        orderIndex: idx,
      });
    } else if (typeof entry === 'object') {
      const rec = entry as Record<string, unknown>;
      const firstName = String(rec.firstName ?? rec.given ?? '').trim();
      const lastName = String(rec.lastName ?? rec.family ?? '').trim();
      const fullName = String(
        rec.fullName ?? rec.name ?? [firstName, lastName].filter(Boolean).join(' '),
      ).trim();
      const isInst =
        rec.fieldMode === 1 || (!firstName && isInstitutionName(fullName || lastName));
      structured.push({
        ...rec,
        firstName: isInst ? '' : firstName,
        lastName: isInst ? lastName || fullName : lastName,
        fullName,
        fieldMode: typeof rec.fieldMode === 'number' ? rec.fieldMode : isInst ? 1 : 0,
        creatorType: String(rec.creatorType ?? rec.role ?? 'author').trim() || 'author',
        orderIndex: typeof rec.orderIndex === 'number' ? rec.orderIndex : idx,
      });
    }
  });
  return structured;
}

/**
 * Calculates non-destructive asset union across multiple duplicate records,
 * deduplicating identical PDF/file attachments that share the same non-empty `fileHash`
 * (or identical non-empty `url` when `fileHash` is absent) while preserving annotation counts.
 */
export function aggregateItemAssets(items: readonly Item[]): AggregatedAssetsSummary {
  const rawTags: unknown[] = [];
  const colSet = new Set<string>();
  const uniqueAttachments: unknown[] = [];
  const seenAttachmentKeys = new Set<string>();
  const notesList: unknown[] = [];
  let duplicateAttachmentCount = 0;
  let totalAnnotationCount = 0;

  const registerAttachment = (att: unknown) => {
    if (!att) return;
    if (typeof att === 'string') {
      const cleanUrl = att.trim();
      if (!isValidValue(cleanUrl)) return;
      const key = `url:${cleanUrl.toLowerCase()}`;
      if (seenAttachmentKeys.has(key)) {
        duplicateAttachmentCount++;
        return;
      }
      seenAttachmentKeys.add(key);
      uniqueAttachments.push(cleanUrl);
      return;
    }

    if (typeof att === 'object') {
      const obj = att as Record<string, unknown>;
      if (typeof obj.annotationCount === 'number' && obj.annotationCount > 0) {
        totalAnnotationCount += obj.annotationCount;
      } else if (Array.isArray(obj.annotations)) {
        totalAnnotationCount += obj.annotations.length;
      }

      const fileHash =
        typeof obj.fileHash === 'string' && obj.fileHash.trim()
          ? obj.fileHash.trim().toLowerCase()
          : typeof obj.sha256 === 'string' && obj.sha256.trim()
            ? obj.sha256.trim().toLowerCase()
            : '';
      const fileUrl =
        typeof obj.url === 'string' && obj.url.trim()
          ? obj.url.trim().toLowerCase()
          : typeof obj.fileUrl === 'string' && obj.fileUrl.trim()
            ? obj.fileUrl.trim().toLowerCase()
            : '';

      const dedupKey = fileHash
        ? `hash:${fileHash}`
        : fileUrl
          ? `url:${fileUrl}`
          : '';

      if (dedupKey) {
        if (seenAttachmentKeys.has(dedupKey)) {
          duplicateAttachmentCount++;
          return;
        }
        seenAttachmentKeys.add(dedupKey);
      }
      uniqueAttachments.push(att);
    }
  };

  for (const it of items) {
    if (Array.isArray(it.tags)) {
      rawTags.push(...it.tags);
    } else if (typeof it.tags === 'string') {
      rawTags.push(it.tags);
    }

    const singleColId = (it as Record<string, unknown>).collectionId;
    if (typeof singleColId === 'string' && isValidValue(singleColId)) {
      colSet.add(singleColId.trim());
    }
    if (Array.isArray(it.collectionIds)) {
      it.collectionIds.forEach((c: unknown) => {
        if (typeof c === 'string' && isValidValue(c)) colSet.add(c.trim());
      });
    }
    if (Array.isArray(it.collections)) {
      it.collections.forEach((c) => {
        if (c && typeof c === 'object' && typeof c.id === 'string' && isValidValue(c.id)) {
          colSet.add(c.id.trim());
        } else if (typeof c === 'string' && isValidValue(c)) {
          colSet.add((c as string).trim());
        }
      });
    }

    if (Array.isArray(it.attachments)) {
      it.attachments.forEach((att) => registerAttachment(att));
    } else {
      const pdfUrl =
        (it as Record<string, unknown>).pdfUrl || (it as Record<string, unknown>).fileUrl;
      if (pdfUrl && isValidValue(pdfUrl)) {
        registerAttachment(pdfUrl);
      }
    }

    if (Array.isArray(it.notes)) {
      for (const n of it.notes) {
        notesList.push(n);
      }
    }
  }

  const tags = normalizeTags(rawTags);
  const collections = Array.from(colSet);

  return {
    totalFiles: uniqueAttachments.length,
    fileList: uniqueAttachments,
    attachments: uniqueAttachments,
    uniqueAttachmentCount: uniqueAttachments.length,
    duplicateAttachmentCount,
    totalAnnotationCount,
    totalNotes: notesList.length,
    noteCount: notesList.length,
    notes: notesList,
    totalTags: tags.length,
    tags,
    totalCollections: collections.length,
    collectionCount: collections.length,
    collections,
    combinedTags: tags,
    combinedCollectionIds: collections,
    attachmentCount: uniqueAttachments.length,
    notesCount: notesList.length,
  };
}
