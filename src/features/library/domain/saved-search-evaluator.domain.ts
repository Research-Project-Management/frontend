/**
 * Client-Side Saved Search AST Leaf Evaluator & Field Extractor.
 *
 * Maintains 100% behavioral parity with Backend `ConditionEvaluatorEngine`:
 * - Relational `identifiers` array (`[{ type, value }]`) + identifier normalization (`cleanDoi`, `extractArxivId`, `cleanIsbn`, `extractPmid`, `extractPmcId`)
 * - Structured `creators` / `contributors` / `authors` (`firstName`, `lastName`, `fullName`, `name`)
 * - Relational `tags` / `keywords` / `labels` / `itemTags` (`{ name }`, `{ tag: { name } }`)
 * - Relational `collection` / `collectionId` / `collectionIds` / `collections` / `collectionItems`
 * - Attachment & Note presence (`hasAttachment`, `attachmentCount`, `hasFile`, `hasPdf`, `hasNotes`, `noteCount`, `isStarred`)
 * - Comprehensive `anyField` aggregation (including notes, attachments, annotations, fulltext indexes, identifiers, tags, creators, venue)
 * - Unicode diacritic-insensitive matching via `foldDiacritics` (`đ -> d`, `NFD`)
 */

import {
  getItemDisplayTitle,
  getPublicationVenue,
  getItemDisplayDate,
} from '@/features/library/domain/metadata';
import { resolveItemFieldValue } from '@/features/library/domain/diff-primitives';
import { foldDiacritics } from '@/features/library/domain/academic-text';
import {
  cleanDoi,
  cleanIsbn,
  extractArxivId,
  extractPmid,
  extractPmcId,
} from '@/features/library/domain/identifiers';
import type { SavedSearchCondition } from '@/features/library/domain/types/saved-searches.types';

export const SEARCH_FIELD_ALIASES: Readonly<Record<string, string>> = {
  author: 'creator',
  authors: 'creator',
  contributor: 'creator',
  contributors: 'creator',
  creators: 'creator',
  tags: 'tag',
  keywords: 'tag',
  labels: 'tag',
  itemTags: 'tag',
  collectionId: 'collection',
  collectionIds: 'collection',
  collections: 'collection',
  collectionItems: 'collection',
  hasPdf: 'hasAttachment',
  has_pdf: 'hasAttachment',
  has_attachment: 'hasAttachment',
  hasFile: 'hasAttachment',
  attachmentCount: 'hasAttachment',
  has_notes: 'hasNotes',
  noteCount: 'hasNotes',
  note: 'noteContent',
  notes: 'noteContent',
  read_status: 'readStatus',
  is_starred: 'isStarred',
  starred: 'isStarred',
  item_type: 'itemType',
  publication_title: 'publicationTitle',
  journal: 'publicationTitle',
  venue: 'publicationTitle',
  citation_key: 'citationKey',
  citekey: 'citationKey',
  arxiv: 'arxivId',
  arxiv_id: 'arxivId',
  archiveId: 'arxivId',
  archiveID: 'arxivId',
};

const IDENTIFIER_FIELD_TO_TYPE: Readonly<Record<string, string>> = {
  doi: 'doi',
  isbn: 'isbn',
  issn: 'issn',
  pmid: 'pmid',
  pmcid: 'pmcid',
  arxivId: 'arxiv',
};

const BOOLEAN_PRESENCE_FIELDS: ReadonlySet<string> = new Set([
  'hasAttachment',
  'hasNotes',
  'isStarred',
  'isRetracted',
]);

export function parseBetweenBounds(raw: unknown): [string, string] | null {
  if (Array.isArray(raw)) {
    if (raw.length < 2) return null;
    const a = String(raw[0] ?? '').trim();
    const b = String(raw[1] ?? '').trim();
    return a && b ? [a, b] : null;
  }
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    const a = String(rec.min ?? rec.from ?? rec.start ?? '').trim();
    const b = String(rec.max ?? rec.to ?? rec.end ?? '').trim();
    return a && b ? [a, b] : null;
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parts = trimmed.includes('..')
    ? trimmed.split('..')
    : trimmed.includes(',')
      ? trimmed.split(',')
      : trimmed.split(/\s+to\s+|\s*;\s*/i);
  if (parts.length < 2) return null;
  const start = (parts[0] ?? '').trim();
  const end = (parts[1] ?? '').trim();
  return start && end ? [start, end] : null;
}

function normalizeIdentifierCandidate(fieldKey: string, rawVal: unknown): string[] {
  if (rawVal === undefined || rawVal === null) return [];
  const rawStr = String(rawVal).trim();
  if (!rawStr) return [];
  const out = new Set<string>([rawStr]);

  if (fieldKey === 'doi') {
    const cleaned = cleanDoi(rawStr);
    if (cleaned) out.add(cleaned);
  } else if (fieldKey === 'arxivId') {
    const extracted = extractArxivId(rawStr);
    if (extracted) {
      out.add(extracted);
      out.add(extracted.replace(/v\d+$/i, ''));
      out.add(`arXiv:${extracted}`);
    }
  } else if (fieldKey === 'isbn') {
    const cleaned = cleanIsbn(rawStr);
    if (cleaned) {
      out.add(cleaned);
      out.add(cleaned.replace(/[-\s]/g, ''));
    }
  } else if (fieldKey === 'pmid') {
    const cleaned = extractPmid(rawStr);
    if (cleaned) out.add(cleaned);
  } else if (fieldKey === 'pmcid') {
    const cleaned = extractPmcId(rawStr);
    if (cleaned) out.add(cleaned);
  }
  return Array.from(out);
}

function extractRelationalIdentifiers(
  item: Record<string, unknown>,
  targetType?: string,
): string[] {
  const identifiers = Array.isArray(item.identifiers) ? item.identifiers : [];
  const out: string[] = [];
  for (const entry of identifiers) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as { type?: unknown; value?: unknown };
    const typeLower = String(rec.type ?? '').trim().toLowerCase();
    const valStr = String(rec.value ?? '').trim();
    if (!valStr) continue;
    if (
      !targetType ||
      typeLower === targetType ||
      (targetType === 'arxiv' &&
        (typeLower === 'arxiv' || typeLower === 'arxivid' || typeLower === 'archiveid'))
    ) {
      const fieldKey = targetType === 'arxiv' ? 'arxivId' : targetType || typeLower;
      for (const norm of normalizeIdentifierCandidate(fieldKey, valStr)) {
        out.push(norm);
      }
    }
  }
  return out;
}

export function extractItemFieldValues(item: Record<string, unknown>, field: string): unknown[] {
  const rawField = field.trim();
  const normalizedField = SEARCH_FIELD_ALIASES[rawField] || rawField;
  const extraFields =
    item.extraFields && typeof item.extraFields === 'object' && !Array.isArray(item.extraFields)
      ? (item.extraFields as Record<string, unknown>)
      : {};
  const metadata =
    item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
      ? (item.metadata as Record<string, unknown>)
      : {};

  if (normalizedField === 'anyField') {
    const candidates: unknown[] = [
      getItemDisplayTitle(item) || item.title,
      resolveItemFieldValue(item, 'abstractNote'),
      item.abstractNote,
      item.abstract,
      getPublicationVenue(item) || item.publicationTitle,
      item.journal,
      resolveItemFieldValue(item, 'publisher') || item.publisher,
      resolveItemFieldValue(item, 'citationKey') || item.citationKey,
      resolveItemFieldValue(item, 'url') || item.url,
      item.extra,
      extraFields.extra,
      getItemDisplayDate(item) ?? item.year,
      ...extractItemFieldValues(item, 'doi'),
      ...extractItemFieldValues(item, 'isbn'),
      ...extractItemFieldValues(item, 'issn'),
      ...extractItemFieldValues(item, 'pmid'),
      ...extractItemFieldValues(item, 'pmcid'),
      ...extractItemFieldValues(item, 'arxivId'),
      ...extractRelationalIdentifiers(item),
      ...extractItemFieldValues(item, 'creator'),
      ...extractItemFieldValues(item, 'tag'),
      ...extractItemFieldValues(item, 'noteContent'),
      ...extractItemFieldValues(item, 'attachmentFilename'),
      ...extractItemFieldValues(item, 'attachmentContent'),
    ];
    return candidates.filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
  }

  if (normalizedField in IDENTIFIER_FIELD_TO_TYPE) {
    const canonicalType = IDENTIFIER_FIELD_TO_TYPE[normalizedField]!;
    const rawCandidates = [
      resolveItemFieldValue(item, normalizedField),
      item[normalizedField],
      item[normalizedField.toUpperCase()],
      extraFields[normalizedField],
      extraFields[normalizedField.toUpperCase()],
      metadata[normalizedField],
      ...(normalizedField === 'arxivId'
        ? [
            item.archiveID,
            item.archiveId,
            extraFields.archiveID,
            extraFields.archiveId,
            metadata.archiveID,
          ]
        : []),
    ];
    const results = new Set<string>();
    for (const candidate of rawCandidates) {
      for (const norm of normalizeIdentifierCandidate(normalizedField, candidate)) {
        results.add(norm);
      }
    }
    for (const relVal of extractRelationalIdentifiers(item, canonicalType)) {
      results.add(relVal);
    }
    return Array.from(results);
  }

  if (normalizedField === 'title') {
    const canonicalTitle = getItemDisplayTitle(item);
    const rawTitle = item.title ?? extraFields.title;
    return [canonicalTitle, rawTitle].filter(
      (v) => v !== undefined && v !== null && String(v).trim() !== '',
    );
  }

  if (normalizedField === 'publicationTitle') {
    const canonicalVenue = getPublicationVenue(item);
    const resolved = resolveItemFieldValue(item, rawField);
    return [
      canonicalVenue,
      resolved,
      item.publicationTitle,
      item.journal,
      item[rawField],
      extraFields.publicationTitle,
      extraFields[rawField],
    ].filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
  }

  if (
    normalizedField === 'year' ||
    normalizedField === 'date' ||
    normalizedField === 'publicationDate'
  ) {
    const canonicalDate = getItemDisplayDate(item);
    const resolved = resolveItemFieldValue(item, normalizedField);
    return [
      canonicalDate,
      resolved,
      item[normalizedField],
      item.publicationDate,
      item.date,
      item.year,
      extraFields[normalizedField],
    ].filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
  }

  if (normalizedField === 'hasAttachment') {
    const attachments = Array.isArray(item.attachments)
      ? item.attachments.filter(
          (a) => !a || typeof a !== 'object' || !(a as { deletedAt?: unknown }).deletedAt,
        )
      : [];
    const fileCount =
      typeof item.fileCount === 'number'
        ? item.fileCount
        : typeof item.attachmentCount === 'number'
          ? item.attachmentCount
          : attachments.length;
    const hasFile = Boolean(
      item.hasAttachment ||
        item.hasFile ||
        item.hasPdf ||
        item.pdfUrl ||
        item.openAccessPdfUrl ||
        item.fileUrl ||
        fileCount > 0,
    );
    if (rawField === 'attachmentCount') {
      return [fileCount, hasFile, String(hasFile)];
    }
    return [hasFile, String(hasFile)];
  }

  if (normalizedField === 'hasNotes') {
    const notesList = Array.isArray(item.notesList)
      ? item.notesList.filter(
          (n) => !n || typeof n !== 'object' || !(n as { deletedAt?: unknown }).deletedAt,
        )
      : Array.isArray(item.notes)
        ? item.notes
        : [];
    const noteCount = typeof item.noteCount === 'number' ? item.noteCount : notesList.length;
    const hasNotes = Boolean(item.hasNotes || noteCount > 0);
    if (rawField === 'noteCount') {
      return [noteCount, hasNotes, String(hasNotes)];
    }
    return [hasNotes, String(hasNotes)];
  }

  if (normalizedField === 'isStarred') {
    const starred = Boolean(item.isStarred || item.starred);
    return [starred, String(starred)];
  }

  if (normalizedField === 'noteContent') {
    const out: string[] = [];
    const notesSources = [
      ...(Array.isArray(item.notes) ? item.notes : []),
      ...(Array.isArray(item.notesList) ? item.notesList : []),
    ];
    for (const n of notesSources) {
      if (typeof n === 'string' && n.trim()) {
        out.push(n.trim());
      } else if (n && typeof n === 'object') {
        const rec = n as {
          title?: unknown;
          content?: unknown;
          contentMd?: unknown;
          note?: unknown;
          deletedAt?: unknown;
        };
        if (rec.deletedAt) continue;
        for (const textCandidate of [rec.title, rec.content, rec.contentMd, rec.note]) {
          if (typeof textCandidate === 'string' && textCandidate.trim()) {
            out.push(textCandidate.trim());
          }
        }
      }
    }
    return out;
  }

  if (normalizedField === 'attachmentFilename' || normalizedField === 'attachmentContent') {
    const attachments = Array.isArray(item.attachments) ? item.attachments : [];
    const out: string[] = [];
    for (const att of attachments) {
      if (!att || typeof att !== 'object') continue;
      const rec = att as {
        deletedAt?: unknown;
        filename?: unknown;
        name?: unknown;
        title?: unknown;
        annotations?: unknown[];
        fullTextIndexes?: unknown[];
      };
      if (rec.deletedAt) continue;
      if (normalizedField === 'attachmentFilename') {
        for (const f of [rec.filename, rec.name, rec.title]) {
          if (typeof f === 'string' && f.trim()) out.push(f.trim());
        }
      } else {
        if (Array.isArray(rec.annotations)) {
          for (const ann of rec.annotations) {
            if (!ann || typeof ann !== 'object') continue;
            const aRec = ann as { deletedAt?: unknown; quoteText?: unknown; comment?: unknown };
            if (aRec.deletedAt) continue;
            if (typeof aRec.quoteText === 'string' && aRec.quoteText.trim()) {
              out.push(aRec.quoteText.trim());
            }
            if (typeof aRec.comment === 'string' && aRec.comment.trim()) {
              out.push(aRec.comment.trim());
            }
          }
        }
        if (Array.isArray(rec.fullTextIndexes)) {
          for (const idx of rec.fullTextIndexes) {
            if (idx && typeof idx === 'object') {
              const text = (idx as { textContent?: unknown }).textContent;
              if (typeof text === 'string' && text.trim()) out.push(text.trim());
            }
          }
        }
      }
    }
    return out;
  }

  if (normalizedField === 'collection') {
    const ids = new Set<string>();
    if (typeof item.collectionId === 'string' && item.collectionId.trim()) {
      ids.add(item.collectionId.trim());
    }
    if (Array.isArray(item.collectionIds)) {
      for (const id of item.collectionIds) {
        if (typeof id === 'string' && id.trim()) ids.add(id.trim());
      }
    }
    const colArrays = [
      ...(Array.isArray(item.collections) ? item.collections : []),
      ...(Array.isArray(item.collectionItems) ? item.collectionItems : []),
    ];
    for (const col of colArrays) {
      if (typeof col === 'string' && col.trim()) {
        ids.add(col.trim());
      } else if (col && typeof col === 'object') {
        const rec = col as {
          collectionId?: unknown;
          id?: unknown;
          name?: unknown;
          collection?: { id?: unknown; name?: unknown };
        };
        for (const candidate of [
          rec.collectionId,
          rec.id,
          rec.name,
          rec.collection?.id,
          rec.collection?.name,
        ]) {
          if (typeof candidate === 'string' && candidate.trim()) {
            ids.add(candidate.trim());
          }
        }
      }
    }
    return Array.from(ids);
  }

  if (normalizedField === 'tag') {
    const tagArrays = [
      ...(Array.isArray(item.tags) ? item.tags : []),
      ...(Array.isArray(item.keywords) ? item.keywords : []),
      ...(Array.isArray(item.labels) ? item.labels : []),
      ...(Array.isArray(item.itemTags) ? item.itemTags : []),
    ];
    const out = new Set<string>();
    for (const t of tagArrays) {
      if (typeof t === 'string' && t.trim()) {
        out.add(t.trim());
      } else if (t && typeof t === 'object') {
        const rec = t as { name?: unknown; label?: unknown; tag?: { name?: unknown } };
        const name = String(rec.name ?? rec.label ?? rec.tag?.name ?? '').trim();
        if (name) out.add(name);
      }
    }
    return Array.from(out);
  }

  if (normalizedField === 'creator') {
    const creatorSources = [
      ...(Array.isArray(item.creators) ? item.creators : []),
      ...(Array.isArray(item.contributors) ? item.contributors : []),
      ...(Array.isArray(item.authors) ? item.authors : []),
      ...(Array.isArray(extraFields.creators) ? (extraFields.creators as unknown[]) : []),
    ];
    const extracted = new Set<string>();
    const pushEntry = (c: unknown) => {
      if (typeof c === 'string' && c.trim()) {
        extracted.add(c.trim());
      } else if (c && typeof c === 'object') {
        const obj = c as Record<string, unknown>;
        const nested =
          obj.contributor && typeof obj.contributor === 'object'
            ? (obj.contributor as Record<string, unknown>)
            : undefined;
        const first = String(obj.firstName ?? nested?.firstName ?? '').trim();
        const last = String(obj.lastName ?? nested?.lastName ?? '').trim();
        const full = String(
          obj.fullName ?? obj.name ?? nested?.fullName ?? nested?.name ?? '',
        ).trim();
        if (full) extracted.add(full);
        if (first && last) {
          extracted.add(`${first} ${last}`);
          extracted.add(`${last}, ${first}`);
        } else if (last) {
          extracted.add(last);
        } else if (first) {
          extracted.add(first);
        }
      }
    };
    for (const c of creatorSources) pushEntry(c);
    return Array.from(extracted);
  }

  const canonicalResolved = resolveItemFieldValue(item, normalizedField);
  if (
    canonicalResolved !== undefined &&
    canonicalResolved !== null &&
    String(canonicalResolved).trim() !== ''
  ) {
    return Array.isArray(canonicalResolved) ? canonicalResolved : [canonicalResolved];
  }

  const raw = item[normalizedField] ?? extraFields[normalizedField] ?? metadata[normalizedField];
  if (Array.isArray(raw)) return raw;
  return raw === undefined || raw === null ? [] : [raw];
}

function normalizeSearchMatchString(val: unknown, field: string): string {
  const rawStr = val !== undefined && val !== null ? String(val).trim() : '';
  if (!rawStr) return '';
  if (field in IDENTIFIER_FIELD_TO_TYPE) {
    const candidates = normalizeIdentifierCandidate(field, rawStr);
    const preferred = candidates[candidates.length - 1] || rawStr;
    return foldDiacritics(preferred).toLowerCase();
  }
  return foldDiacritics(rawStr).toLowerCase();
}

export function evaluateLeafCondition(
  item: Record<string, unknown>,
  condition: SavedSearchCondition,
): boolean {
  const rawField = condition.field.trim();
  const normalizedField = SEARCH_FIELD_ALIASES[rawField] || rawField;
  const op = condition.operator as string;
  const target = condition.value;
  const values = extractItemFieldValues(item, rawField);

  if (BOOLEAN_PRESENCE_FIELDS.has(normalizedField)) {
    const boolVal = values.some((v) => v === true || v === 'true');
    if (op === 'isPresent' || op === 'is_present' || op === 'isNotEmpty' || op === 'is_not_empty') {
      return boolVal;
    }
    if (op === 'isAbsent' || op === 'is_absent' || op === 'isEmpty' || op === 'is_empty') {
      return !boolVal;
    }
  }

  if (op === 'isPresent' || op === 'is_present' || op === 'isNotEmpty' || op === 'is_not_empty') {
    return values.some((v) => v !== null && v !== undefined && String(v).trim() !== '');
  }

  if (op === 'isAbsent' || op === 'is_absent' || op === 'isEmpty' || op === 'is_empty') {
    return (
      values.length === 0 ||
      values.every((v) => v === null || v === undefined || String(v).trim() === '')
    );
  }

  if (op === 'isBetween' || op === 'between') {
    const bounds = parseBetweenBounds(target);
    if (!bounds) return false;
    const minNum = Number(bounds[0]);
    const maxNum = Number(bounds[1]);
    if (!Number.isNaN(minNum) && !Number.isNaN(maxNum)) {
      return values.some((v) => {
        const num = typeof v === 'number' ? v : Number(v);
        return !Number.isNaN(num) && num >= minNum && num <= maxNum;
      });
    }
    const minTime = Date.parse(bounds[0]);
    const maxTime = Date.parse(bounds[1]);
    if (!Number.isNaN(minTime) && !Number.isNaN(maxTime)) {
      return values.some((v) => {
        const t = Date.parse(String(v));
        return !Number.isNaN(t) && t >= minTime && t <= maxTime;
      });
    }
    const minStr = foldDiacritics(bounds[0]).toLowerCase();
    const maxStr = foldDiacritics(bounds[1]).toLowerCase();
    return values.some((v) => {
      const s = foldDiacritics(String(v).trim()).toLowerCase();
      return s >= minStr && s <= maxStr;
    });
  }

  if (op === 'isInTheLast' || op === 'in_the_last') {
    const rawStr = String(target ?? '').trim();
    const m = rawStr.match(/^(\d+)\s*([a-zA-Z]+)?$/);
    if (!m) return false;
    const count = Number(m[1]);
    if (Number.isNaN(count) || count <= 0) return false;
    const unit = (m[2] || 'days').toLowerCase();
    const daysMultiplier = unit.startsWith('y')
      ? 365
      : unit.startsWith('m')
        ? 30
        : unit.startsWith('w')
          ? 7
          : 1;
    const cutoffMs = Date.now() - count * daysMultiplier * 86_400_000;
    return values.some((v) => {
      const ts = Date.parse(String(v));
      return !Number.isNaN(ts) && ts >= cutoffMs;
    });
  }

  const targetFolded = normalizeSearchMatchString(target, normalizedField);
  const targetNum = typeof target === 'number' ? target : Number(target);

  switch (op) {
    case 'is':
    case 'equals':
      return values.some((v) => {
        const candFolded = foldDiacritics(String(v).trim()).toLowerCase();
        if (candFolded === targetFolded) return true;
        if (normalizedField === 'creator' || normalizedField === 'tag') {
          return candFolded.includes(targetFolded);
        }
        return false;
      });
    case 'isNot':
    case 'is_not':
    case 'not_equals':
      return values.every((v) => {
        const candFolded = foldDiacritics(String(v).trim()).toLowerCase();
        if (candFolded === targetFolded) return false;
        if (normalizedField === 'creator' || normalizedField === 'tag') {
          return !candFolded.includes(targetFolded);
        }
        return true;
      });
    case 'contains':
      return values.some((v) =>
        foldDiacritics(String(v)).toLowerCase().includes(targetFolded),
      );
    case 'doesNotContain':
    case 'does_not_contain':
      return values.every(
        (v) => !foldDiacritics(String(v)).toLowerCase().includes(targetFolded),
      );
    case 'beginsWith':
    case 'begins_with':
      return values.some((v) =>
        foldDiacritics(String(v).trim()).toLowerCase().startsWith(targetFolded),
      );
    case 'endsWith':
    case 'ends_with':
      return values.some((v) =>
        foldDiacritics(String(v).trim()).toLowerCase().endsWith(targetFolded),
      );
    case 'isGreaterThan':
    case 'greater_than':
    case 'gt':
      if (!Number.isNaN(targetNum) && targetFolded !== '') {
        return values.some((v) => {
          const num = typeof v === 'number' ? v : Number(v);
          return !Number.isNaN(num) && num > targetNum;
        });
      }
      return values.some((v) => String(v).trim() > String(target ?? '').trim());
    case 'isLessThan':
    case 'less_than':
    case 'lt':
      if (!Number.isNaN(targetNum) && targetFolded !== '') {
        return values.some((v) => {
          const num = typeof v === 'number' ? v : Number(v);
          return !Number.isNaN(num) && num < targetNum;
        });
      }
      return values.some((v) => String(v).trim() < String(target ?? '').trim());
    default:
      return false;
  }
}
