import type { Item } from './types/library.types';
import { ALL_SCHEMA_FIELD_KEYS } from './types/item-fields.constants';
import { normalizeAuthors } from './creators';
import {
  isValidValue,
  cleanValue,
  stripLatexMarkup,
  cleanAbstractText,
  normalizeTags,
  normalizeNotes,
  cleanFilenameToTitle,
} from './metadata-sanitizers';
import {
  getItemDisplayTitle,
  getPublicationVenue,
  getItemDisplayDate,
  isAllowedItemExtraKey,
  parseItemExtraField,
} from './metadata-extra';

/**
/**
 * All Zotero Schema v42 field keys promoted from `extraFields` / `metadata` onto top-level `Item`
 * during `mapBackendItem`. Automatically derived from `ALL_SCHEMA_FIELD_KEYS`.
 */
export const ALL_SCHEMA_PROMOTE_KEYS: readonly string[] = Array.from(
  ALL_SCHEMA_FIELD_KEYS,
).filter((k) => k !== "title" && k !== "extra");

const ALL_SCHEMA_PROMOTE_KEY_SET = new Set<string>(ALL_SCHEMA_PROMOTE_KEYS);

const PUBLISHER_CANDIDATE_KEYS = [
  "publisher",
  "university",
  "institution",
  "issuingAuthority",
  "authority",
  "court",
  "legislativeBody",
  "company",
  "organization",
  "repository",
  "distributor",
  "studio",
  "network",
  "label",
] as const;

const DATE_CANDIDATE_KEYS = [
  "publicationDate",
  "date",
  "issueDate",
  "dateDecided",
  "dateEnacted",
  "filingDate",
] as const;

function pickFirstValidField(
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
function mergeRawItemPartials(rec: Record<string, unknown>): {
  mapped: Record<string, unknown>;
  ef: Record<string, unknown>;
} {
  const rawMetadata =
    rec.metadata &&
    typeof rec.metadata === "object" &&
    !Array.isArray(rec.metadata)
      ? (rec.metadata as Record<string, unknown>)
      : {};
  const rawExtraFields =
    rec.extraFields &&
    typeof rec.extraFields === "object" &&
    !Array.isArray(rec.extraFields)
      ? (rec.extraFields as Record<string, unknown>)
      : {};
  const ef: Record<string, unknown> = { ...rawMetadata, ...rawExtraFields };
  const mapped: Record<string, unknown> = { ...rawMetadata, ...rec };

  const efKeys = Object.keys(ef);
  if (efKeys.length > 0) {
    mapped.extraFields = { ...ef };
    for (const k of efKeys) {
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

const CANONICAL_SCALAR_PROJECTIONS: ReadonlyArray<
  readonly [string, readonly string[]]
> = [
  ["abstractNote", ["abstractNote", "abstract"]],
  ["publicationTitle", ["publicationTitle", "journal"]],
  ["journalAbbreviation", ["journalAbbreviation", "journalAbbr"]],
  ["doi", ["doi", "DOI"]],
  ["issn", ["issn", "ISSN"]],
  ["isbn", ["isbn", "ISBN"]],
  ["pmid", ["pmid", "PMID"]],
  ["pmcid", ["pmcid", "PMCID"]],
  ["arxivId", ["arxivId", "archiveID", "archiveId"]],
  ["license", ["license", "rights"]],
  ["accessDate", ["accessDate", "accessedAt"]],
  ["citationKey", ["citationKey", "key"]],
  ["retractionReason", ["retractionReason", "reason"]],
  ["itemType", ["itemType", "type"]],
  ["volume", ["volume", "reporterVolume", "codeVolume"]],
  ["pages", ["pages", "firstPage", "codePages"]],
];

/**
 * Step 2 of `mapBackendItem`: Projects Zotero Schema v42 base fields and legacy backend aliases
 * onto canonical top-level `Item` properties.
 */
function projectCanonicalBaseFields(
  mapped: Record<string, unknown>,
  rec: Record<string, unknown>,
  ef: Record<string, unknown>,
): void {
  mapped.title =
    getItemDisplayTitle(mapped) ||
    (typeof rec.title === "string" ? rec.title : "");

  const normalizedAuthors = normalizeAuthors(
    rec.authors as unknown[],
    (rec.creators || ef.creators) as Array<{
      firstName?: string;
      lastName?: string;
      name?: string;
      fullName?: string;
      creatorType?: string;
    }>,
  );
  if (
    normalizedAuthors.length > 0 &&
    (!Array.isArray(rec.authors) || rec.authors.length === 0)
  ) {
    mapped.authors = normalizedAuthors;
  }

  const rawCreators = (rec.creators || ef.creators) as unknown;
  if (Array.isArray(rawCreators)) {
    mapped.creators = rawCreators.map((c, idx) => {
      if (!c || typeof c !== "object") return c;
      const cr = c as Record<string, unknown>;
      const firstName =
        typeof cr.firstName === "string"
          ? cr.firstName
          : typeof cr.given === "string"
            ? cr.given
            : undefined;
      const lastName =
        typeof cr.lastName === "string"
          ? cr.lastName
          : typeof cr.family === "string"
            ? cr.family
            : undefined;
      const fullName =
        typeof cr.fullName === "string" && cr.fullName.trim()
          ? cr.fullName.trim()
          : typeof cr.name === "string" && cr.name.trim()
            ? cr.name.trim()
            : [firstName, lastName].filter(Boolean).join(" ").trim();
      return {
        ...cr,
        orderIndex: typeof cr.orderIndex === "number" ? cr.orderIndex : idx,
        creatorType:
          typeof cr.creatorType === "string" && cr.creatorType.trim()
            ? cr.creatorType.trim()
            : "author",
        fullName,
      };
    });
  }

  for (const [targetKey, sourceKeys] of CANONICAL_SCALAR_PROJECTIONS) {
    if (!isValidValue(mapped[targetKey])) {
      const val = pickFirstValidField(rec, ef, sourceKeys);
      if (isValidValue(val)) {
        mapped[targetKey] = String(val).trim();
      }
    }
  }

  if (!isValidValue(mapped.numberOfPages)) {
    const numPagesVal = pickFirstValidField(rec, ef, [
      "numberOfPages",
      "numPages",
    ]);
    if (isValidValue(numPagesVal)) {
      mapped.numberOfPages = numPagesVal;
    }
  }

  if (!Array.isArray(mapped.notes) || mapped.notes.length === 0) {
    if (Array.isArray(rec.notesList) && rec.notesList.length > 0) {
      mapped.notes = rec.notesList;
    }
  }
  if (!Array.isArray(mapped.attachments) || mapped.attachments.length === 0) {
    if (Array.isArray(rec.files) && rec.files.length > 0) {
      mapped.attachments = rec.files;
    }
  }

  // Normalize tags/keywords from string[], { name: string }[], { tag: string }[], or itemTags
  const rawTagCandidates = [
    ...(Array.isArray(rec.tags) ? rec.tags : []),
    ...(Array.isArray(rec.itemTags) ? rec.itemTags : []),
    ...(Array.isArray(ef.tags) ? (ef.tags as unknown[]) : []),
  ];
  if (rawTagCandidates.length > 0) {
    const seenTags = new Set<string>();
    const cleanTags: string[] = [];
    for (const entry of rawTagCandidates) {
      let tagName = "";
      if (typeof entry === "string") {
        tagName = entry.trim();
      } else if (entry && typeof entry === "object") {
        const obj = entry as {
          name?: unknown;
          tag?: unknown;
        };
        if (typeof obj.name === "string") {
          tagName = obj.name.trim();
        } else if (typeof obj.tag === "string") {
          tagName = obj.tag.trim();
        } else if (
          obj.tag &&
          typeof obj.tag === "object" &&
          typeof (obj.tag as { name?: unknown }).name === "string"
        ) {
          tagName = ((obj.tag as { name: string }).name || "").trim();
        }
      }
      if (tagName) {
        const lower = tagName.toLowerCase();
        if (!seenTags.has(lower)) {
          seenTags.add(lower);
          cleanTags.push(tagName);
        }
      }
    }
    mapped.tags = cleanTags;
    if (!Array.isArray(mapped.keywords) || mapped.keywords.length === 0) {
      mapped.keywords = cleanTags;
    }
  }
  if (
    !Array.isArray(mapped.collectionIds) ||
    mapped.collectionIds.length === 0
  ) {
    const derivedCollectionIds = new Set<string>();
    if (typeof rec.collectionId === "string" && rec.collectionId.trim()) {
      derivedCollectionIds.add(rec.collectionId.trim());
    }
    const rawCols = Array.isArray(mapped.collections)
      ? mapped.collections
      : Array.isArray(rec.collections)
        ? rec.collections
        : [];
    for (const c of rawCols) {
      if (c && typeof c === "object") {
        const obj = c as { id?: unknown; collectionId?: unknown };
        const cid = obj.collectionId ?? obj.id;
        if (typeof cid === "string" && cid.trim()) {
          derivedCollectionIds.add(cid.trim());
        }
      }
    }
    if (Array.isArray(rec.collectionItems)) {
      for (const ci of rec.collectionItems) {
        if (ci && typeof ci === "object") {
          const obj = ci as {
            collectionId?: unknown;
            collection?: { id?: unknown };
          };
          const cid = obj.collectionId ?? obj.collection?.id;
          if (typeof cid === "string" && cid.trim()) {
            derivedCollectionIds.add(cid.trim());
          }
        }
      }
    }
    if (derivedCollectionIds.size > 0) {
      mapped.collectionIds = Array.from(derivedCollectionIds);
    }
  }
  const retractionDetails =
    rec.retractionDetails &&
    typeof rec.retractionDetails === "object" &&
    !Array.isArray(rec.retractionDetails)
      ? (rec.retractionDetails as Record<string, unknown>)
      : ef.retractionDetails &&
          typeof ef.retractionDetails === "object" &&
          !Array.isArray(ef.retractionDetails)
        ? (ef.retractionDetails as Record<string, unknown>)
        : undefined;
  const resolvedNoticeUrl =
    (retractionDetails?.noticeUrl as string | undefined) ||
    (rec.noticeUrl as string | undefined) ||
    (ef.noticeUrl as string | undefined);
  if (typeof resolvedNoticeUrl === "string" && resolvedNoticeUrl.trim()) {
    mapped.noticeUrl = resolvedNoticeUrl.trim();
  }
  if (mapped.isFavorite === undefined && typeof rec.isStarred === "boolean") {
    mapped.isFavorite = rec.isStarred;
  }
  if (mapped.notesCount === undefined && typeof rec.noteCount === "number") {
    mapped.notesCount = rec.noteCount;
  }

  if (!isValidValue(mapped.publicationTitle)) {
    const resolvedVenue = getPublicationVenue(mapped);
    if (isValidValue(resolvedVenue)) {
      mapped.publicationTitle = resolvedVenue;
    }
  }

  if (!isValidValue(rec.publisher)) {
    const rawPublisher = pickFirstValidField(rec, ef, PUBLISHER_CANDIDATE_KEYS);
    if (isValidValue(rawPublisher)) {
      mapped.publisher = stripLatexMarkup(String(rawPublisher).trim());
    }
  }

  if (!isValidValue(rec.year)) {
    const displayDate = getItemDisplayDate(mapped);
    const resolvedYear =
      typeof displayDate === "number"
        ? displayDate
        : typeof rec.year === "number" && rec.year > 0
          ? rec.year
          : undefined;
    if (resolvedYear !== undefined) {
      mapped.year = resolvedYear;
    }
  }

  if (!isValidValue(rec.publicationDate) || !isValidValue(rec.date)) {
    const rawDateStr = pickFirstValidField(rec, ef, DATE_CANDIDATE_KEYS);
    if (isValidValue(rawDateStr)) {
      const cleanDate = String(rawDateStr).trim();
      if (!isValidValue(rec.publicationDate)) mapped.publicationDate = cleanDate;
      if (!isValidValue(rec.date)) mapped.date = cleanDate;
    }
  }

  if (!isValidValue(rec.place) && !isValidValue(ef.place)) {
    const fallbackPlace = pickFirstValidField(rec, ef, [
      "repositoryLocation",
      "country",
    ]);
    if (isValidValue(fallbackPlace)) {
      mapped.place = String(fallbackPlace).trim();
    }
  }
}

const EMPTY_BACKEND_ITEM_DEFAULTS: Item = {
  id: "",
  title: "Untitled",
  itemType: "journalArticle",
  authors: [],
  editors: [],
  creators: [],
  contributors: [],
  year: 0,
  publicationTitle: "",
  journalAbbreviation: "",
  publisher: "",
  volume: "",
  issue: "",
  pages: "",
  isbn: "",
  issn: "",
  doi: "",
  url: "",
  abstractNote: "",
  keywords: [],
  language: "",
  shortTitle: "",
  license: "",
  citationKey: "",
  extra: "",
  extraFields: {},
  fields: {},
  tags: [],
  itemTags: [],
  collections: [],
  collectionIds: [],
  attachments: [],
  notes: [],
  fileUrl: "",
  filename: "",
  mimeType: "",
  size: 0,
  hasFile: false,
  fileCount: 0,
  notesCount: 0,
  noteCount: 0,
  attachmentCount: 0,
  isFavorite: false,
  isStarred: false,
  isRead: false,
  readStatus: "unread",
  rating: 0,
  isRetracted: false,
  isMyPublication: false,
  crossrefEnriched: false,
  identifiers: [],
  version: 1,
  isDeleted: false,
  createdAt: "1970-01-01T00:00:00.000Z",
  updatedAt: "1970-01-01T00:00:00.000Z",
};

/**
 * Declaratively normalizes a raw backend item or Zotero Schema v42 record into a canonical UI `Item`,
 * composing `mergeRawItemPartials` and `projectCanonicalBaseFields`.
 */
export function mapBackendItem(
  raw?: Partial<Item> | Record<string, unknown> | null,
): Item {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_BACKEND_ITEM_DEFAULTS };
  }

  const rec = raw as Record<string, unknown>;
  const { mapped, ef } = mergeRawItemPartials(rec);
  projectCanonicalBaseFields(mapped, rec, ef);

  const normalizedCollections = Array.isArray(mapped.collections)
    ? (mapped.collections as Array<{ id?: string; collectionId?: string }>)
    : [];
  const normalizedCollectionIds =
    Array.isArray(mapped.collectionIds) && mapped.collectionIds.length > 0
      ? (mapped.collectionIds as string[])
      : normalizedCollections
          .map((c) => c?.collectionId || c?.id)
          .filter((id): id is string => Boolean(id));

  const retractionDetails =
    (mapped.retractionDetails as Record<string, unknown> | undefined) ??
    (rec.retractionDetails as Record<string, unknown> | undefined);
  const noticeUrl =
    (retractionDetails?.noticeUrl as string | undefined) ||
    (rec.noticeUrl as string | undefined) ||
    (mapped.noticeUrl as string | undefined);

  return {
    ...EMPTY_BACKEND_ITEM_DEFAULTS,
    ...(mapped as Partial<Item>),
    collectionIds: normalizedCollectionIds,
    ...(noticeUrl ? { noticeUrl } : {}),
    createdAt:
      typeof mapped.createdAt === "string" && mapped.createdAt.trim()
        ? mapped.createdAt
        : EMPTY_BACKEND_ITEM_DEFAULTS.createdAt,
    updatedAt:
      typeof mapped.updatedAt === "string" && mapped.updatedAt.trim()
        ? mapped.updatedAt
        : EMPTY_BACKEND_ITEM_DEFAULTS.updatedAt,
  };
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
      if (typeof id === "string" && id.trim()) {
        ids.add(id.trim());
      }
    }
  }
  if (Array.isArray(item.collections)) {
    for (const c of item.collections) {
      if (c && typeof c === "object") {
        const cid =
          (c as { collectionId?: string; id?: string }).collectionId ||
          (c as { id?: string }).id;
        if (typeof cid === "string" && cid.trim()) {
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
  status: "uploading" | "extracting" | "completed" | "error" | "UPLOADING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
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
  const rawName = p.filename ?? p.fileName ?? "";
  const title = p.extractedTitle || cleanFilenameToTitle(rawName);
  const isExtracting = p.status === "extracting" || p.status === "PROCESSING";
  return {
    ...EMPTY_BACKEND_ITEM_DEFAULTS,
    id: p.id,
    title,
    itemType: "journalArticle",
    authors: isExtracting ? ["Processing metadata..."] : ["Uploading raw file..."],
    year: null,
    scopeId: scopeId ?? null,
    collectionIds: collectionId ? [collectionId] : [],
    attachments: [
      {
        id: `att-${p.id}`,
        filename: rawName,
        size: p.fileSize ?? 0,
        mimeType: p.mimeType || "application/pdf",
        url: p.fileUrl || "",
        linkMode: "imported_file",
        attachmentType: "supplementary",
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
