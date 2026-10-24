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

  if (Object.keys(ef).length > 0) {
    mapped.extraFields = { ...ef };
  }

  for (const k of ALL_SCHEMA_PROMOTE_KEYS) {
    if (!isValidValue(mapped[k]) && isValidValue(ef[k])) {
      mapped[k] = ef[k];
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
  if (
    !Array.isArray(mapped.collectionIds) ||
    mapped.collectionIds.length === 0
  ) {
    const derivedCollectionIds = new Set<string>();
    if (typeof rec.collectionId === "string" && rec.collectionId.trim()) {
      derivedCollectionIds.add(rec.collectionId.trim());
    }
    if (Array.isArray(rec.collections)) {
      for (const c of rec.collections) {
        if (c && typeof c === "object") {
          const cid = (c as { id?: unknown }).id;
          if (typeof cid === "string" && cid.trim()) {
            derivedCollectionIds.add(cid.trim());
          }
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
  if (mapped.isFavorite === undefined && typeof rec.isStarred === "boolean") {
    mapped.isFavorite = rec.isStarred;
  }
  if (mapped.notesCount === undefined && typeof rec.noteCount === "number") {
    mapped.notesCount = rec.noteCount;
  }

  const resolvedVenue = getPublicationVenue(mapped);
  if (!isValidValue(mapped.publicationTitle) && isValidValue(resolvedVenue)) {
    mapped.publicationTitle = resolvedVenue;
  }

  const rawPublisher = pickFirstValidField(rec, ef, PUBLISHER_CANDIDATE_KEYS);
  if (!isValidValue(rec.publisher) && isValidValue(rawPublisher)) {
    mapped.publisher = stripLatexMarkup(String(rawPublisher).trim());
  }

  const displayDate = getItemDisplayDate(mapped);
  const resolvedYear =
    typeof displayDate === "number"
      ? displayDate
      : typeof rec.year === "number" && rec.year > 0
        ? rec.year
        : undefined;
  if (!isValidValue(rec.year) && resolvedYear !== undefined) {
    mapped.year = resolvedYear;
  }

  const rawDateStr = pickFirstValidField(rec, ef, DATE_CANDIDATE_KEYS);
  if (isValidValue(rawDateStr)) {
    const cleanDate = String(rawDateStr).trim();
    if (!isValidValue(rec.publicationDate)) mapped.publicationDate = cleanDate;
    if (!isValidValue(rec.date)) mapped.date = cleanDate;
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
  ragStatus: "none",
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
  return {
    ...EMPTY_BACKEND_ITEM_DEFAULTS,
    ...(mapped as Partial<Item>),
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
