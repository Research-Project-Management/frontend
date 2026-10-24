import type { Item } from './types/library.types';
import {
  ALL_SCHEMA_FIELD_KEYS,
  INITIAL_ITEM_TYPE_FIELDS_MAP,
} from './types/item-fields.constants';
import {
  getTitleFieldForType,
  getVenueFieldForType,
  getDateFieldForType,
} from './types/item-types.types';
import {
  cleanValue,
  isValidValue,
  stripLatexMarkup,
} from './metadata-sanitizers';

/**
 * Extracts canonical display title from an Item across Zotero Schema v42 BASE_FIELD_MAPPINGS
 * (`title`, `caseName` for `case`, `nameOfAct` for `statute`, `subject` for `email`).
 */
export function getItemDisplayTitle(
  item?: Partial<Item> | Record<string, unknown> | null,
): string {
  if (!item || typeof item !== "object") return "";
  const rec = item as Record<string, unknown>;
  const ef = (rec.extraFields as Record<string, unknown> | undefined) || {};

  const clean = (val: unknown): string => {
    if (!isValidValue(val)) return "";
    return stripLatexMarkup(String(val).trim());
  };

  const itemType = typeof rec.itemType === "string" ? rec.itemType : undefined;
  const preferredTitleField = getTitleFieldForType(itemType);
  if (preferredTitleField && preferredTitleField !== "title") {
    const val = clean(rec[preferredTitleField] ?? ef[preferredTitleField]);
    if (val) return val;
  }

  const fallbackFields = ["title", "caseName", "nameOfAct", "subject"] as const;
  for (const field of fallbackFields) {
    const val = clean(rec[field] ?? ef[field]);
    if (val) return val;
  }

  return "";
}

/**
 * Extracts publication venue (journal, conference, court, issuingAuthority, repository, publisher)
 * for UI cards, tables, citations, and exports across all 37 Zotero Schema v42 item types.
 */
export function getPublicationVenue(
  item?: Partial<Item> | Record<string, unknown> | null,
): string {
  if (!item || typeof item !== "object") return "";
  const rec = item as Record<string, unknown>;
  const extra = (rec.extraFields as Record<string, unknown> | undefined) || {};
  const meta = (rec.metadata as Record<string, unknown> | undefined) || {};

  const clean = (val: unknown): string => {
    if (!isValidValue(val)) return "";
    return stripLatexMarkup(String(val).trim());
  };

  const itemType = (item as Item).itemType;
  const preferredField = getVenueFieldForType(itemType);
  if (preferredField) {
    const val = clean(rec[preferredField] ?? extra[preferredField] ?? meta[preferredField]);
    if (val) return val;
  }

  const fallbackFields = [
    "publicationTitle",
    "journal",
    "proceedingsTitle",
    "conferenceName",
    "bookTitle",
    "meetingName",
    "repository",
    "publisher",
    "court",
    "issuingAuthority",
    "authority",
    "company",
    "organization",
    "institution",
    "university",
    "distributor",
    "studio",
    "network",
    "label",
    "programTitle",
    "websiteTitle",
    "blogTitle",
    "forumTitle",
    "dictionaryTitle",
    "encyclopediaTitle",
    "sessionTitle",
    "legislativeBody",
    "committee",
    "code",
    "reporter",
  ];

  for (const field of fallbackFields) {
    const val = clean(rec[field] ?? extra[field] ?? meta[field]);
    if (val) return val;
  }

  // Preprints / arXiv fallback: If item has an arxivId or eprint and no explicit venue was found
  const arxivId = clean(
    rec.arxivId ??
      extra.arxivId ??
      meta.arxivId ??
      rec.archiveID ??
      extra.archiveID ??
      meta.archiveID,
  );
  if (arxivId) {
    return "arXiv";
  }

  return "";
}

/**
 * Formats an academic itemType into a user-friendly label ("Journal Article", "Conference Paper").
 */
export function formatItemTypeLabel(rawType?: string | null): string {
  if (!rawType) return "—";
  const str = String(rawType).trim();
  const withSpaces = str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ");
  return withSpaces.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Genuine Zotero 7 `Extra` keys that are also valid schema fields on specific item types
 * (`PMID`/`PMCID` on `journalArticle`, `originalDate` on `book`/`bookSection`) and must remain
 * allowed as explicit `Key: Value` lines in the Zotero `Extra` textarea.
 */
const ALLOWED_ITEM_EXTRA_LINE_KEYS = new Set<string>([
  "pmid",
  "pmcid",
  "originaldate",
]);

export const INTERNAL_AND_DEDICATED_METADATA_KEYS = new Set<string>([
  // Automatically derived from all 121 Zotero Schema v42 fields across all 37 item types
  ...Array.from(ALL_SCHEMA_FIELD_KEYS)
    .map((f) => f.toLowerCase())
    .filter((k) => !ALLOWED_ITEM_EXTRA_LINE_KEYS.has(k)),
  // Internal / system / audit / duplicate / retraction / ingestion telemetry state
  "dismissedduplicateids",
  "mergedcitationkeys",
  "mergedfromids",
  "isretracted",
  "retraction",
  "retractionstatus",
  "retractiondate",
  "retractionnature",
  "retractionreasons",
  "retractionnoticedoi",
  "retractiondetails",
  "retractioncheckedat",
  "ismypublication",
  "publicationconfirmedat",
  "provenance",
  "fieldprovenance",
  "sourceprovider",
  "source",
  "sources",
  "extractionstatus",
  "ingestionstatus",
  "verificationscore",
  "isverified",
  "matchedsignals",
  "missingfields",
  "isselfsufficient",
  "qualityscore",
  "engineused",
  "primarycategory",
  "categories",
  "journalref",
  "warnings",
  "disambiguationwarning",
  "rejectedciteddoi",
  "wafkind",
  "promptuploadpdf",
  "crossrefenriched",
  "confidencescore",
  "originprovider",
  "canonicalid",
  "canonicalurl",
  "resolvedat",
  "ragdocid",
  "ragindexedat",
  "raglastattemptat",
  "ragattempts",
  "ragerror",
  "ragstatus",
  "_version",
  "version",
  "expectedversion",
  "isdeleted",
  "silent",
  "deletedat",
  "createdat",
  "updatedat",
  "dateadded",
  "datemodified",
  "id",
  "itemid",
  "paperid",
  "userid",
  "projectid",
  "workspaceid",
  "scopeid",
  "uploadedbyid",
  "createdbyid",
  "fileid",
  "filename",
  "mimetype",
  "size",
  "primaryfile",
  "hasfile",
  "attachmentcount",
  "notecount",
  "firstauthor",
  "userstates",
  "states",
  "readstatus",
  "rating",
  "lastreadat",
  "outgoingrel",
  "incomingrel",
  "relations",
  "seealso",
  "identifiers",
  "itemtags",
  "zoterotags",
  "collectionitems",
  "noteslist",
  "ingestionruns",
  "itemmetadata",
  "publications",
  // First-class DB column aliases & relation keys
  "abstract",
  "journal",
  "journalabbr",
  "numberofpages",
  "arxiv",
  "arxivid",
  "openaccesspdfurl",
  "pdfurl",
  "fileurl",
  "year",
  "publicationdate",
  "accessedat",
  "itemtype",
  "license",
  "citekey",
  "citationcount",
  "referencecount",
  "authority",
  "authors",
  "creators",
  "contributors",
  "editors",
  "tags",
  "keywords",
  "keywordslist",
  "labels",
  "notes",
  "attachments",
  "collections",
  "collectionid",
  "collectionids",
  "extra",
  "extrafields",
]);

/**
 * Genuine Zotero 7 `Extra` / CSL overflow identifier keys that may be promoted
 * from structured `extraFields` / JSONB into the `Extra` display when they are NOT
 * already a dedicated first-class schema field of the item's `itemType`.
 */
const GENUINE_ITEM_EXTRA_OVERFLOW_KEYS = new Set<string>([
  "pmid",
  "pmcid",
  "nihmsid",
  "oclc",
  "lccn",
  "mr",
  "zbl",
  "originaldate",
  "tex.ids",
  "texids",
]);

export function isAllowedItemExtraKey(rawKey: string): boolean {
  const trimmed = rawKey.trim();
  if (!trimmed || trimmed.startsWith("_")) return false;
  const normalized = trimmed.toLowerCase().replace(/[\s_-]+/g, "");
  return !INTERNAL_AND_DEDICATED_METADATA_KEYS.has(normalized);
}


/**
 * Formats the extra metadata field for inspector display.
 */
export function formatExtraDisplay(item: Item): string {
  const sanitized = formatAndSanitizeExtraMetadata(
    item.extra,
    item.extraFields as Record<string, unknown> | undefined,
    item,
  );
  if (sanitized) {
    return sanitized.replace(/\r?\n+/g, ", ");
  }
  return "—";
}

const DEDICATED_FIELDS_BY_TYPE_MAP: ReadonlyMap<string, ReadonlySet<string>> =
  new Map(
    Object.entries(INITIAL_ITEM_TYPE_FIELDS_MAP).map(([type, fields]) => [
      type,
      new Set(
        fields.map((f) => f.toLowerCase().replace(/[\s_-]+/g, "")),
      ),
    ]),
  );

const EMPTY_DEDICATED_FIELDS_SET: ReadonlySet<string> = new Set();

/**
 * Formats and cleans extra metadata text for the Inspector's Extra tab,
 * stripping internal system/audit state and already-displayed first-class Inspector fields
 * while preserving genuine Zotero 7 `Extra` lines (`PMID`, `PMCID`, `NIHMSID`, `Original Date`, `tex.ids`, etc.).
 */
export function formatAndSanitizeExtraMetadata(
  rawExtraMetadata?: string | null,
  additionalExtraFields?: Record<string, unknown> | null,
  associatedPaperItem?: Partial<Item> | null,
): string {
  const lines: string[] = [];
  const seenNormalizedLines = new Set<string>();

  const effectiveExtraFields =
    additionalExtraFields ||
    (associatedPaperItem?.extraFields as Record<string, unknown> | undefined);

  const resolvedItemType =
    (typeof associatedPaperItem?.itemType === "string" &&
      associatedPaperItem.itemType) ||
    (typeof effectiveExtraFields?.itemType === "string" &&
      effectiveExtraFields.itemType) ||
    undefined;

  const dedicatedFieldsForType: ReadonlySet<string> =
    (resolvedItemType && DEDICATED_FIELDS_BY_TYPE_MAP.get(resolvedItemType)) ||
    EMPTY_DEDICATED_FIELDS_SET;

  const isDedicatedFieldOnCurrentType = (rawKey: string): boolean => {
    const normKey = rawKey
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
    return normKey !== "extra" && dedicatedFieldsForType.has(normKey);
  };

  const canPromoteStructuredKeyToExtra = (rawKey: string): boolean => {
    const normKey = rawKey
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
    if (!GENUINE_ITEM_EXTRA_OVERFLOW_KEYS.has(normKey)) return false;
    return !isDedicatedFieldOnCurrentType(rawKey);
  };

  const pushUniqueLine = (rawLine: string) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    const kvMatch = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9._\s-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (kvMatch) {
      const key = kvMatch[1]!.trim();
      const val = kvMatch[2]!.trim();
      if (
        !isAllowedItemExtraKey(key) ||
        isDedicatedFieldOnCurrentType(key) ||
        !isValidValue(val) ||
        val === "[object Object]"
      ) {
        return;
      }
    }
    const norm = trimmed
      .toLowerCase()
      .replace(/\s*:\s*/g, ": ")
      .replace(/\s+/g, " ");
    if (!seenNormalizedLines.has(norm)) {
      seenNormalizedLines.add(norm);
      lines.push(trimmed);
    }
  };

  if (typeof rawExtraMetadata === "string" && rawExtraMetadata.trim()) {
    const trimmed = rawExtraMetadata.trim();
    if (trimmed.startsWith("{") && !trimmed.startsWith("{:")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const parsedObj = parsed as Record<string, unknown>;
          if (
            typeof parsedObj._rawExtra === "string" &&
            parsedObj._rawExtra.trim()
          ) {
            for (const l of parsedObj._rawExtra.split(/\r?\n/)) {
              pushUniqueLine(l);
            }
          }
          for (const [key, value] of Object.entries(parsedObj)) {
            if (key === "_rawExtra" || typeof value === "object") continue;
            if (canPromoteStructuredKeyToExtra(key) && isValidValue(value)) {
              pushUniqueLine(`${key}: ${value}`);
            }
          }
        }
      } catch {
        for (const l of trimmed.split(/\r?\n/)) {
          pushUniqueLine(l);
        }
      }
    } else {
      for (const l of trimmed.split(/\r?\n/)) {
        pushUniqueLine(l);
      }
    }
  }

  if (effectiveExtraFields && typeof effectiveExtraFields === "object") {
    for (const [key, value] of Object.entries(effectiveExtraFields)) {
      if (key === "originalDate" || typeof value === "object") continue;
      if (canPromoteStructuredKeyToExtra(key) && isValidValue(value)) {
        pushUniqueLine(`${key}: ${value}`);
      }
    }
  }

  return lines.join("\n").trim();
}

/**
 * Checks whether an inspector field value is present and not a placeholder/null string.
 */


/**
 * Extracts a canonical display year (number) or date string from an Item across Zotero Schema v42
 * (`year`, `publicationDate`, `date`, `issueDate`, `dateDecided`, `dateEnacted`, `filingDate`).
 */
export function getItemDisplayDate(
  item?: Partial<Item> | Record<string, unknown> | null,
): number | string | null {
  if (!item || typeof item !== "object") return null;
  const rec = item as Record<string, unknown>;
  const ef = (rec.extraFields as Record<string, unknown> | undefined) || {};
  if (isValidValue(rec.year)) {
    const num = Number(rec.year);
    if (!isNaN(num) && num >= 1000 && num <= 2999) return num;
  }

  const itemType = typeof rec.itemType === "string" ? rec.itemType : undefined;
  const preferredDateField = getDateFieldForType(itemType);
  const preferredVal =
    preferredDateField && preferredDateField !== "date"
      ? (rec[preferredDateField] ?? ef[preferredDateField])
      : undefined;

  const dateSource =
    preferredVal ||
    rec.publicationDate ||
    rec.date ||
    rec.issueDate ||
    rec.dateDecided ||
    rec.dateEnacted ||
    rec.filingDate ||
    ef.publicationDate ||
    ef.date ||
    ef.issueDate ||
    ef.dateDecided ||
    ef.dateEnacted ||
    ef.filingDate;

  if (isValidValue(dateSource)) {
    const match = String(dateSource).match(/\b(1[7-9]\d{2}|20\d{2})\b/);
    if (match) return parseInt(match[1], 10);
    return String(dateSource).trim();
  }
  return null;
}


const EXTRA_KEY_ALIASES: Record<string, readonly string[]> = {
  doi: ["doi", "DOI"],
  citationkey: ["citationKey", "citeKey"],
  citekey: ["citationKey", "citeKey"],
  arxiv: ["arxivId", "archiveID", "archiveId", "arXiv"],
  arxivid: ["arxivId", "archiveID", "archiveId", "arXiv"],
  archiveid: ["archiveID", "archiveId", "arxivId"],
  pmid: ["pmid", "PMID"],
  pmcid: ["pmcid", "PMCID"],
  isbn: ["isbn", "ISBN"],
  issn: ["issn", "ISSN"],
  eventplace: ["eventPlace", "event-place", "place"],
  originaldate: ["originalDate", "original-date"],
  publisher: ["publisher"],
  institution: ["institution", "publisher"],
  university: ["university", "publisher"],
  authority: ["issuingAuthority", "authority", "publisher"],
  issuingauthority: ["issuingAuthority", "authority", "publisher"],
  court: ["court", "authority", "publisher"],
  organization: ["organization", "publisher"],
  company: ["company", "publisher"],
  containertitle: ["containerTitle", "publicationTitle"],
  publicationtitle: ["publicationTitle"],
  proceedingstitle: ["proceedingsTitle", "publicationTitle"],
  booktitle: ["bookTitle", "publicationTitle"],
  meetingname: ["meetingName", "conferenceName", "publicationTitle"],
  versionnumber: ["versionNumber", "version"],
  version: ["versionNumber", "version"],
  patentnumber: ["patentNumber", "number"],
  docketnumber: ["docketNumber", "number"],
  publiclawnumber: ["publicLawNumber", "number"],
  reportnumber: ["reportNumber", "number"],
};

const PARSED_EXTRA_STRING_CACHE = new Map<string, Readonly<Record<string, string>>>();
const PARSED_EXTRA_OBJECT_CACHE = new WeakMap<object, Readonly<Record<string, string>>>();
const MAX_EXTRA_CACHE_SIZE = 5000;

/**
 * Parses item "Extra" field extended syntax (both `Key: Value` lines and `{:Key: Value}` blocks)
 * into a dictionary supporting both exact, lowercase, and canonical field lookups.
 */
export function parseItemExtraField(extra?: unknown): Record<string, string> {
  if (!extra) return {};

  if (typeof extra === "string") {
    const trimmed = extra.trim();
    if (!trimmed) return {};
    const cached = PARSED_EXTRA_STRING_CACHE.get(trimmed);
    if (cached) {
      PARSED_EXTRA_STRING_CACHE.delete(trimmed);
      PARSED_EXTRA_STRING_CACHE.set(trimmed, cached);
      return cached;
    }
  } else if (typeof extra === "object" && !Array.isArray(extra)) {
    const cached = PARSED_EXTRA_OBJECT_CACHE.get(extra);
    if (cached) return cached;
  }

  const result: Record<string, string> = {};
  const setKey = (rawKey: string, rawVal: string) => {
    const k = rawKey.trim();
    const v = rawVal.trim();
    if (!k || !isValidValue(v)) return;
    result[k] = v;
    const lower = k.toLowerCase();
    result[lower] = v;
    const collapsed = lower.replace(/[\s_-]+/g, "");
    result[collapsed] = v;
    const aliases = EXTRA_KEY_ALIASES[collapsed];
    if (aliases) {
      for (const alias of aliases) {
        if (!result[alias]) result[alias] = v;
        if (!result[alias.toLowerCase()]) result[alias.toLowerCase()] = v;
      }
    }
  };

  if (typeof extra === "object" && !Array.isArray(extra)) {
    for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
      if (v !== null && v !== undefined && isValidValue(v)) {
        setKey(k, String(v));
      }
    }
    const frozen = Object.freeze(result);
    PARSED_EXTRA_OBJECT_CACHE.set(extra, frozen);
    return frozen;
  }

  if (typeof extra !== "string") return result;
  const trimmed = extra.trim();
  if (!trimmed) return result;

  const cacheAndReturn = (res: Record<string, string>): Readonly<Record<string, string>> => {
    const frozen = Object.freeze(res);
    if (PARSED_EXTRA_STRING_CACHE.size >= MAX_EXTRA_CACHE_SIZE) {
      const oldest = PARSED_EXTRA_STRING_CACHE.keys().next().value;
      if (oldest !== undefined) {
        PARSED_EXTRA_STRING_CACHE.delete(oldest);
      }
    }
    PARSED_EXTRA_STRING_CACHE.set(trimmed, frozen);
    return frozen;
  };

  // 1. Parse JSON if formatted as JSON object
  if (trimmed.startsWith("{") && !trimmed.startsWith("{:")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(
          parsed as Record<string, unknown>,
        )) {
          if (v !== null && v !== undefined && isValidValue(v)) {
            setKey(k, String(v));
          }
        }
        return cacheAndReturn(result);
      }
    } catch {
      // Fall through to line-by-line Extra field parsing
    }
  }

  // 2. Parse inline {:Key: Value} cheater syntax blocks
  const inlineRegex = /\{:([^:}]+):\s*([^}]+)\}/g;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlineRegex.exec(trimmed)) !== null) {
    setKey(inlineMatch[1], inlineMatch[2]);
  }

  // 3. Parse standard `Key: Value` lines
  const lines = trimmed.split(/\r?\n/);
  for (const line of lines) {
    const cleanLine = line.replace(/\{:[^:}]+:[^}]+\}/g, "").trim();
    if (!cleanLine) continue;
    const match = cleanLine.match(
      /^([A-Za-z][A-Za-z0-9\s_-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (match) {
      setKey(match[1], match[2]);
    }
  }

  return cacheAndReturn(result);
}


/**
 * Normalizes an uploaded file name to a clean presentation title.
 * Strips file extensions and normalizes dashes/underscores to title case words.
 */