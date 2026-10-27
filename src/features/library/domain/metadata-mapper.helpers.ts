import type { Item } from './types/library.types';
import { ALL_SCHEMA_FIELD_KEYS } from './types/item-fields.constants';
import { registerSchemaRegistryUpdateListener } from './types/item-types.types';
import { isValidValue, cleanFilenameToTitle } from './metadata-sanitizers';

/**
 * All Zotero Schema v42 field keys promoted from `extraFields` / `metadata` onto top-level `Item`
 * during `mapBackendItem`. Automatically derived from `ALL_SCHEMA_FIELD_KEYS`.
 */
const MUTABLE_SCHEMA_PROMOTE_KEYS: string[] = Array.from(
  ALL_SCHEMA_FIELD_KEYS,
).filter((k) => k !== 'title' && k !== 'extra');

export const ALL_SCHEMA_PROMOTE_KEYS: readonly string[] =
  MUTABLE_SCHEMA_PROMOTE_KEYS;

export const ALL_SCHEMA_PROMOTE_KEY_SET = new Set<string>(MUTABLE_SCHEMA_PROMOTE_KEYS);

function refreshSchemaPromoteKeys(): void {
  const nextKeys = Array.from(ALL_SCHEMA_FIELD_KEYS).filter(
    (k) => k !== 'title' && k !== 'extra',
  );
  MUTABLE_SCHEMA_PROMOTE_KEYS.splice(
    0,
    MUTABLE_SCHEMA_PROMOTE_KEYS.length,
    ...nextKeys,
  );
  ALL_SCHEMA_PROMOTE_KEY_SET.clear();
  for (const k of nextKeys) {
    ALL_SCHEMA_PROMOTE_KEY_SET.add(k);
  }
}

registerSchemaRegistryUpdateListener(refreshSchemaPromoteKeys);

export const CONTAINER_TITLE_CANDIDATE_KEYS = [
  'publicationTitle',
  'containerTitle',
  'journal',
  'bookTitle',
  'proceedingsTitle',
  'encyclopediaTitle',
  'dictionaryTitle',
  'websiteTitle',
  'blogTitle',
  'forumTitle',
  'programTitle',
] as const;

export const SUBTYPE_CANDIDATE_KEYS = [
  'type',
  'genre',
  'thesisType',
  'reportType',
  'presentationType',
  'manuscriptType',
  'websiteType',
  'postType',
  'letterType',
  'mapType',
] as const;

export const PLACE_CANDIDATE_KEYS = [
  'eventPlace',
  'address',
  'location',
  'repositoryLocation',
  'country',
] as const;

export const PUBLISHER_CANDIDATE_KEYS = [
  'publisher',
  'university',
  'institution',
  'issuingAuthority',
  'authority',
  'court',
  'legislativeBody',
  'company',
  'organization',
  'repository',
  'distributor',
  'studio',
  'network',
  'label',
] as const;

export const DATE_CANDIDATE_KEYS = [
  'publicationDate',
  'date',
  'issueDate',
  'dateDecided',
  'dateEnacted',
  'filingDate',
] as const;

export const CANONICAL_SCALAR_PROJECTIONS: ReadonlyArray<
  readonly [string, readonly string[]]
> = [
  ['abstractNote', ['abstractNote', 'abstract']],
  ['publicationTitle', ['publicationTitle', 'journal']],
  ['journalAbbreviation', ['journalAbbreviation', 'journalAbbr']],
  ['doi', ['doi', 'DOI']],
  ['issn', ['issn', 'ISSN']],
  ['isbn', ['isbn', 'ISBN']],
  ['pmid', ['pmid', 'PMID']],
  ['pmcid', ['pmcid', 'PMCID']],
  ['arxivId', ['arxivId', 'archiveID', 'archiveId']],
  ['license', ['license', 'rights']],
  ['accessDate', ['accessDate', 'accessedAt']],
  ['citationKey', ['citationKey', 'key']],
  ['retractionReason', ['retractionReason', 'reason']],
  ['itemType', ['itemType', 'type']],
  ['volume', ['volume', 'reporterVolume', 'codeVolume']],
  ['pages', ['pages', 'firstPage', 'codePages']],
];

export const EMPTY_BACKEND_ITEM_DEFAULTS: Item = {
  id: '',
  title: 'Untitled',
  itemType: 'journalArticle',
  authors: [],
  editors: [],
  creators: [],
  contributors: [],
  year: 0,
  publicationTitle: '',
  journalAbbreviation: '',
  publisher: '',
  volume: '',
  issue: '',
  pages: '',
  isbn: '',
  issn: '',
  doi: '',
  url: '',
  abstractNote: '',
  keywords: [],
  language: '',
  shortTitle: '',
  license: '',
  citationKey: '',
  extra: '',
  extraFields: {},
  fields: {},
  tags: [],
  itemTags: [],
  collections: [],
  collectionIds: [],
  attachments: [],
  notes: [],
  fileUrl: '',
  filename: '',
  mimeType: '',
  size: 0,
  hasFile: false,
  fileCount: 0,
  notesCount: 0,
  noteCount: 0,
  attachmentCount: 0,
  isFavorite: false,
  isStarred: false,
  isRead: false,
  readStatus: 'unread',
  rating: 0,
  isRetracted: false,
  isMyPublication: false,
  crossrefEnriched: false,
  identifiers: [],
  version: 1,
  isDeleted: false,
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
};

export function pickFirstValidField(
  rec: Record<string, unknown>,
  ef: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const k of keys) {
    if (isValidValue(rec[k])) return rec[k];
  }
  for (const k of keys) {
    if (isValidValue(ef[k])) return ef[k];
  }
  return undefined;
}

/**
 * Step 1 of `mapBackendItem`: Merges `raw.metadata`, `raw.extraFields`, and top-level `raw`
 * into a single normalized partial record while promoting all Zotero Schema v42 keys.
 */
export function mergeRawItemPartials(rec: Record<string, unknown>): {
  mapped: Record<string, unknown>;
  ef: Record<string, unknown>;
} {
  const rawMetadata =
    rec.metadata &&
    typeof rec.metadata === 'object' &&
    !Array.isArray(rec.metadata)
      ? (rec.metadata as Record<string, unknown>)
      : {};
  const rawExtraFields =
    rec.extraFields &&
    typeof rec.extraFields === 'object' &&
    !Array.isArray(rec.extraFields)
      ? (rec.extraFields as Record<string, unknown>)
      : {};
  const ef: Record<string, unknown> = { ...rawMetadata, ...rawExtraFields };
  const mapped: Record<string, unknown> = { ...rawMetadata, ...rec };

  const unmappedFieldsLower = new Set<string>();
  for (const k of Object.keys(ef)) {
    const m = k.match(/^__unmapped_[^_]+_(.+)$/i);
    if (m && m[1]) {
      unmappedFieldsLower.add(m[1].toLowerCase().replace(/[\s_-]+/g, ''));
    }
  }

  const efKeys = Object.keys(ef);
  if (efKeys.length > 0) {
    mapped.extraFields = { ...ef };
    for (const k of efKeys) {
      const normKey = k.toLowerCase().replace(/[\s_-]+/g, '');
      if (unmappedFieldsLower.has(normKey)) {
        continue;
      }
      if (
        ALL_SCHEMA_PROMOTE_KEY_SET.has(k) &&
        !isValidValue(mapped[k]) &&
        isValidValue(ef[k])
      ) {
        mapped[k] = ef[k];
      }
    }
  }

  return { mapped, ef };
}

export function hasExplicitUserStateInPayload(
  raw?: Partial<Item> | Record<string, unknown> | null,
): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const rec = raw as Record<string, unknown>;
  if ('_hasExplicitUserState' in rec && typeof rec._hasExplicitUserState === 'boolean') {
    return rec._hasExplicitUserState;
  }
  return (
    Array.isArray(rec.states) ||
    Array.isArray(rec.userStates) ||
    rec.isStarred !== undefined ||
    rec.isFavorite !== undefined ||
    rec.isRead !== undefined ||
    rec.readStatus !== undefined ||
    rec.rating !== undefined
  );
}

/**
 * Pure domain selector that returns all unique collection IDs assigned to a `LibraryItem`
 * from both `item.collectionIds` and `item.collections`.
 */
export function getAssignedCollectionIds(
  item: Partial<Item> | null | undefined,
): string[] {
  if (!item) return [];
  const ids = new Set<string>();
  if (Array.isArray(item.collectionIds)) {
    for (const id of item.collectionIds) {
      if (typeof id === 'string' && id.trim()) {
        ids.add(id.trim());
      }
    }
  }
  if (Array.isArray(item.collections)) {
    for (const c of item.collections) {
      if (c && typeof c === 'object') {
        const cid =
          (c as { collectionId?: string; id?: string }).collectionId ||
          (c as { id?: string }).id;
        if (typeof cid === 'string' && cid.trim()) {
          ids.add(cid.trim());
        }
      }
    }
  }
  return Array.from(ids);
}

export interface ProvisionalUploadItemInput {
  id: string;
  filename?: string;
  fileName?: string;
  extractedTitle?: string;
  fileSize?: number;
  mimeType?: string;
  fileUrl?: string;
  status:
    | 'uploading'
    | 'extracting'
    | 'completed'
    | 'error'
    | 'UPLOADING'
    | 'PROCESSING'
    | 'SUCCEEDED'
    | 'FAILED';
  progress: number;
  error?: string;
  createdAt: string;
}

/**
 * Creates a canonical provisional `Item` representing an active background file upload/extraction.
 */
export function createProvisionalUploadItem(
  p: ProvisionalUploadItemInput,
  scopeId?: string,
  collectionId?: string | null,
): Item {
  const rawName = p.filename ?? p.fileName ?? '';
  const title = p.extractedTitle || cleanFilenameToTitle(rawName);
  const isExtracting = p.status === 'extracting' || p.status === 'PROCESSING';
  return {
    ...EMPTY_BACKEND_ITEM_DEFAULTS,
    id: p.id,
    title,
    itemType: 'journalArticle',
    authors: isExtracting ? ['Processing metadata...'] : ['Uploading raw file...'],
    year: null,
    scopeId: scopeId ?? null,
    collectionIds: collectionId ? [collectionId] : [],
    attachments: [
      {
        id: `att-${p.id}`,
        filename: rawName,
        size: p.fileSize ?? 0,
        mimeType: p.mimeType || 'application/pdf',
        url: p.fileUrl || '',
        linkMode: 'imported_file',
        attachmentType: 'supplementary',
      },
    ],
    hasFile: true,
    fileCount: 1,
    attachmentCount: 1,
    createdAt: p.createdAt,
    dateAdded: p.createdAt,
    _isProcessing: true,
    _processingStatus: p.status,
    _processingProgress: p.progress,
    _processingError: p.error,
  };
}
