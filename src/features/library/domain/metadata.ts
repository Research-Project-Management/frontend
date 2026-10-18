/**
 * Presentation Model: Academic Metadata Formatting, Display Labels & Notes/Tags
 *
 * NOTE: The Backend Server is the authoritative single source of truth for
 * metadata normalization, abstract cleaning, CSL validation, and noise filtering.
 *
 * This file provides UI presentation helpers for rendering item types, venue
 * badges, notes, and tags.
 */

import type { Item } from "@/features/library/domain/types/library.types";
import {
  getVenueFieldForType,
  getTitleFieldForType,
  getDateFieldForType,
} from "@/features/library/domain/types/library.types";
import { INITIAL_ITEM_TYPE_FIELDS_MAP } from "@/features/library/domain/types/item-fields.constants";
import { normalizeAuthors } from "./creators";

const LATEX_DIACRITIC_MAP: ReadonlyArray<
  readonly [RegExp, (match: string, c1: string, c2: string) => string]
> = [
  [
    /\{?\\`(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0300`.normalize("NFC"),
  ],
  [
    /\{?\\'(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0301`.normalize("NFC"),
  ],
  [
    /\{?\\\^(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0302`.normalize("NFC"),
  ],
  [
    /\{?\\~(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0303`.normalize("NFC"),
  ],
  [
    /\{?\\"(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0308`.normalize("NFC"),
  ],
  [
    /\{?\\=(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0304`.normalize("NFC"),
  ],
  [
    /\{?\\\.(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0307`.normalize("NFC"),
  ],
  [
    /\{?\\u(?:\{\\?([a-zA-Z])\}|\s+\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0306`.normalize("NFC"),
  ],
  [
    /\{?\\v(?:\{\\?([a-zA-Z])\}|\s+\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u030C`.normalize("NFC"),
  ],
  [
    /\{?\\H(?:\{\\?([a-zA-Z])\}|\s+\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u030B`.normalize("NFC"),
  ],
  [
    /\{?\\c(?:\{\\?([a-zA-Z])\}|\s+\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0327`.normalize("NFC"),
  ],
  [
    /\{?\\k(?:\{\\?([a-zA-Z])\}|\s+\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0328`.normalize("NFC"),
  ],
  [
    /\{?\\r(?:\{\\?([a-zA-Z])\}|\s+\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u030A`.normalize("NFC"),
  ],
];

/** Strips LaTeX macros, decodes LaTeX diacritics, and unescapes symbols common in BibTeX */
export function stripLatexMarkup(str: string): string {
  if (!str || typeof str !== "string") return "";
  if (!str.includes("\\") && !str.includes("{") && !str.includes("}")) {
    return str.trim();
  }
  // Normalize dotless \i and \j first so accent commands like {\'\i}, \'{\i}, \'\i combine cleanly
  let out = str.replace(/\\i\b\s*/g, "i").replace(/\\j\b\s*/g, "j");
  for (const [pattern, replacer] of LATEX_DIACRITIC_MAP) {
    out = out.replace(pattern, replacer);
  }
  out = out
    .replace(/\{\\aa\}|\\aa\b/g, "å")
    .replace(/\{\\AA\}|\\AA\b/g, "Å")
    .replace(/\{\\ae\}|\\ae\b/g, "æ")
    .replace(/\{\\AE\}|\\AE\b/g, "Æ")
    .replace(/\{\\oe\}|\\oe\b/g, "œ")
    .replace(/\{\\OE\}|\\OE\b/g, "Œ")
    .replace(/\{\\o\}|\\o\b/g, "ø")
    .replace(/\{\\O\}|\\O\b/g, "Ø")
    .replace(/\{\\l\}|\\l\b/g, "ł")
    .replace(/\{\\L\}|\\L\b/g, "Ł")
    .replace(/\{\\dj\}|\\dj\b/g, "đ")
    .replace(/\{\\DJ\}|\\DJ\b/g, "Đ")
    .replace(/\{\\ss\}|\\ss\b/g, "ß")
    .replace(/\\([&%$#_{}])/g, "$1")
    .replace(
      /\\(?:textbf|textit|textsf|texttt|textsc|emph|text|mathrm|mathbf|mathit)\s*\{([^}]+)\}/gi,
      "$1",
    )
    .replace(/\\(?:bf|it|em|rm|sf|tt|large|Large|small|tiny)\b\s*/gi, "")
    .replace(/[{}]/g, "")
    .trim();
  return out;
}

const INVALID_TAG_TOKENS = new Set([
  "null",
  "undefined",
  "n/a",
  "na",
  "n.a.",
  "n.a",
  "none",
  "nil",
  "unknown",
  "false",
  "true",
  "sample",
  "draft",
  "test",
  "etc",
  "etc.",
  "et al",
  "et al.",
  "downloaded",
  "downloaded from",
  "full text",
  "pdf",
  "abstract",
  "keywords",
  "keyword",
  "index terms",
  "key words",
  "open access",
  "all rights reserved",
  "peer-reviewed",
  "original article",
  "research article",
  "review article",
  "multidisciplinary",
  "general",
  "miscellaneous",
  "misc",
]);

/**
 * Cleans and validates a single tag in the frontend UI.
 */
export function cleanSingleFrontendTag(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let str = raw
    .replace(/[\uFFFD]/g, "")
    .replace(
      /^(?:tags?|keywords?|index terms?|categor(?:y|ies)|subject(?: areas?)?|topics?|terms?|classification|descriptors?|field(?: of study)?)[:—\-\s]+/i,
      "",
    )
    .replace(/^[#"''`[{<•·*—\-\s]+/, "")
    .replace(/["''`\]}>.,;:—\-\s•·*]+$/, "")
    .trim();

  if (str.startsWith("(") && str.endsWith(")")) {
    str = str.slice(1, -1).trim();
  } else if (str.startsWith("(") && !str.includes(")")) {
    str = str.slice(1).trim();
  } else if (str.endsWith(")") && !str.includes("(")) {
    str = str.slice(0, -1).trim();
  }

  str = stripLatexMarkup(str);
  str = str
    .replace(/<[^>]+>/g, "")
    .replace(/[\xA0\r\n\s]+/g, " ")
    .trim()
    .normalize("NFC");

  if (!str || str.length < 2 || str.length > 255) return null;
  const lower = str.toLowerCase();
  if (INVALID_TAG_TOKENS.has(lower)) return null;
  if (/^\d+$/.test(str) || /^\d{1,4}[-–—/]\d{1,4}$/.test(str)) return null;
  if (
    /^(?:doi[:\s/]|https?:\/\/|www\.|10\.\d{4,9}\/|(?:pmid|pmcid|isbn|issn|arxiv)[:\s/]|downloaded\s+(?:from|on|by)\b)/i.test(
      str,
    )
  ) {
    return null;
  }
  if (
    /^(?:(?:p|pp|v)\.\s*|(?:p|pp|v)\s+|(?:page|pages|vol|volume|no|number|issue)\.?\s*)\d+(?:\s*[-–—]\s*\d+)?$/i.test(
      str,
    )
  ) {
    return null;
  }
  return str;
}

/**
 * Normalizes tags from an Item for inspector display.
 */
export function normalizeTags(
  rawItem?:
    | { tags?: unknown; keywords?: unknown; labels?: unknown }
    | unknown[]
    | string
    | null,
): string[] {
  if (!rawItem) return [];

  const candidates: unknown[] = [];
  if (Array.isArray(rawItem)) {
    candidates.push(...rawItem);
  } else if (typeof rawItem === "object") {
    const obj = rawItem as Record<string, unknown>;
    if (Array.isArray(obj.tags)) candidates.push(...obj.tags);
    if (Array.isArray(obj.keywords)) candidates.push(...obj.keywords);
    if (Array.isArray(obj.labels)) candidates.push(...obj.labels);
    if (typeof obj.tags === "string") candidates.push(obj.tags);
    if (typeof obj.keywords === "string") candidates.push(obj.keywords);
    if (typeof obj.labels === "string") candidates.push(obj.labels);
  } else if (typeof rawItem === "string") {
    candidates.push(rawItem);
  }

  const tagList: string[] = [];
  const seenLower = new Set<string>();
  const addTag = (cleaned: string | null) => {
    if (!cleaned) return;
    const lower = cleaned.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      tagList.push(cleaned);
    }
  };

  for (const item of candidates) {
    if (typeof item === "string") {
      const parts =
        item.includes(";") || item.includes(",") || item.includes("•")
          ? item.split(/[,;•]+/)
          : [item];
      for (const part of parts) {
        addTag(cleanSingleFrontendTag(part));
      }
    } else if (item && typeof item === "object") {
      const tagObj = item as Record<string, unknown>;
      const name =
        typeof tagObj.name === "string"
          ? tagObj.name
          : typeof tagObj.tag === "string"
            ? tagObj.tag
            : "";
      if (name) {
        addTag(cleanSingleFrontendTag(name));
      }
    }
  }

  return tagList;
}

export interface NormalizedNote {
  id: string;
  note?: string;
  content: string;
  title?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  dateModified?: string;
}

/**
 * Cleans HTML tags and entities from a note string while preserving paragraph structure.
 */
export function cleanNoteContent(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  if (!/<\/?[a-z][\s\S]*>/i.test(raw) && !raw.includes("&")) {
    return raw.trim();
  }
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `# ${c.trim()}\n\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `## ${c.trim()}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `### ${c.trim()}\n\n`)
    .replace(
      /<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi,
      (_, c) => `#### ${c.trim()}\n\n`,
    )
    .replace(
      /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
      (_, c) => `> ${c.trim()}\n\n`,
    )
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `- ${c.trim()}\n`)
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => `${c.trim()}\n\n`)
    .replace(/<\/div>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(
      /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      "[$2]($1)",
    )
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Normalizes an array of notes from an Item for inspector display.
 */
export function normalizeNotes(rawNotes?: unknown): NormalizedNote[] {
  if (!rawNotes) return [];
  if (!Array.isArray(rawNotes)) {
    if (typeof rawNotes === "string") {
      const cleaned = cleanNoteContent(rawNotes);
      if (cleaned) {
        return [{ id: "note-0", note: cleaned, content: cleaned }];
      }
    }
    return [];
  }

  const results: NormalizedNote[] = [];
  const seenKeys = new Set<string>();
  let index = 0;
  for (const n of rawNotes) {
    if (!n) continue;
    if (typeof n === "string") {
      const cleaned = cleanNoteContent(n);
      const dedupeKey = `text:${cleaned.toLowerCase()}`;
      if (cleaned && !seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        results.push({
          id: `note-${index++}`,
          note: cleaned,
          content: cleaned,
        });
      }
    } else if (typeof n === "object") {
      const obj = n as Record<string, unknown>;
      const rawText =
        typeof obj.contentMd === "string" && obj.contentMd
          ? obj.contentMd
          : typeof obj.content === "string" && obj.content
            ? obj.content
            : typeof obj.note === "string"
              ? obj.note
              : "";
      const cleaned = cleanNoteContent(rawText);
      const realId =
        typeof obj.id === "string" && obj.id.trim().length > 0
          ? obj.id.trim()
          : null;
      const dedupeKey = realId
        ? `id:${realId}`
        : `text:${cleaned.toLowerCase()}`;
      if (cleaned && !seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        results.push({
          id: realId || `note-${index++}`,
          note: cleaned,
          content: cleaned,
          title: typeof obj.title === "string" ? obj.title : undefined,
          tags: Array.isArray(obj.tags)
            ? obj.tags.filter((t): t is string => typeof t === "string")
            : undefined,
          createdAt:
            typeof obj.createdAt === "string" ? obj.createdAt : undefined,
          updatedAt:
            typeof obj.updatedAt === "string" ? obj.updatedAt : undefined,
          dateModified:
            typeof obj.dateModified === "string" ? obj.dateModified : undefined,
        });
      }
    }
  }

  return results;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ndash;": "–",
  "&mdash;": "—",
  "&lsquo;": "‘",
  "&rsquo;": "’",
  "&ldquo;": "“",
  "&rdquo;": "”",
};

/**
 * Fallback abstract text cleaner for UI presentation.
 * Strips JATS/XML/HTML tags (e.g. `<jats:title>Abstract</jats:title><jats:p>...`),
 * decodes HTML entities, strips leading "Abstract" headers, and filters placeholder strings.
 */
export function cleanAbstractText(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  if (!isValidValue(text)) return "";

  let cleaned = text
    // Strip leading <jats:title>Abstract</jats:title> or <title>Abstract</title> blocks
    .replace(
      /<(?:jats:)?title[^>]*>\s*abstract\s*:?\s*<\/(?:jats:)?title>/gi,
      " ",
    )
    // Replace paragraph/block closing tags with spaces so sentences don't concatenate
    .replace(/<\/(?:jats:)?(?:p|sec|div|li|br)\s*>/gi, " ")
    // Strip remaining XML/HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode named HTML entities
    .replace(
      /&(?:amp|lt|gt|quot|#39|apos|nbsp|ndash|mdash|lsquo|rsquo|ldquo|rdquo);/gi,
      (m) => HTML_ENTITIES[m.toLowerCase()] ?? m,
    )
    // Decode numeric HTML entities
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    // Strip leading "Abstract:" or "Summary:" prefix if left over
    .replace(/^(?:abstract|summary)\s*[:.—\-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!isValidValue(cleaned)) return "";
  return cleaned;
}

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

  const clean = (val: unknown): string => {
    if (!isValidValue(val)) return "";
    return stripLatexMarkup(String(val).trim());
  };

  const itemType = (item as Item).itemType;
  const preferredField = getVenueFieldForType(itemType);
  if (preferredField) {
    const val = clean(rec[preferredField] ?? extra[preferredField]);
    if (val) return val;
  }

  const fallbackFields = [
    "journal",
    "publicationTitle",
    "bookTitle",
    "proceedingsTitle",
    "conferenceName",
    "meetingName",
    "court",
    "issuingAuthority",
    "authority",
    "repository",
    "publisher",
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
    if (field in rec) {
      const val = clean(rec[field]);
      if (val) return val;
    }
  }

  if (extra && typeof extra === "object") {
    for (const field of fallbackFields) {
      if (field in extra) {
        const val = clean(extra[field]);
        if (val) return val;
      }
    }
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
 * All 121 canonical Zotero Schema v42 field names derived automatically from the 37 item types.
 */
export const ALL_ZOTERO_SCHEMA_FIELDS: ReadonlySet<string> = new Set<string>(
  Object.values(INITIAL_ITEM_TYPE_FIELDS_MAP).flat(),
);

/**
 * Genuine Zotero 7 `Extra` keys that are also valid schema fields on specific item types
 * (`PMID`/`PMCID` on `journalArticle`, `originalDate` on `book`/`bookSection`) and must remain
 * allowed as explicit `Key: Value` lines in the Zotero `Extra` textarea.
 */
const ALLOWED_ZOTERO_EXTRA_LINE_KEYS = new Set<string>([
  "pmid",
  "pmcid",
  "originaldate",
]);

export const INTERNAL_AND_DEDICATED_METADATA_KEYS = new Set<string>([
  // Automatically derived from all 121 Zotero Schema v42 fields across all 37 item types
  ...Array.from(ALL_ZOTERO_SCHEMA_FIELDS)
    .map((f) => f.toLowerCase())
    .filter((k) => !ALLOWED_ZOTERO_EXTRA_LINE_KEYS.has(k)),
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

export const INTERNAL_EXTRA_KEYS = INTERNAL_AND_DEDICATED_METADATA_KEYS;

/**
 * Genuine Zotero 7 `Extra` / CSL overflow identifier keys that may be promoted
 * from structured `extraFields` / JSONB into the `Extra` display when they are NOT
 * already a dedicated first-class schema field of the item's `itemType`.
 */
const GENUINE_ZOTERO_EXTRA_OVERFLOW_KEYS = new Set<string>([
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

export function isAllowedZoteroExtraKey(rawKey: string): boolean {
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

  const dedicatedFieldsForType = new Set<string>(
    resolvedItemType && INITIAL_ITEM_TYPE_FIELDS_MAP[resolvedItemType]
      ? INITIAL_ITEM_TYPE_FIELDS_MAP[resolvedItemType].map((f) =>
          f.toLowerCase().replace(/[\s_-]+/g, ""),
        )
      : [],
  );

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
    if (!GENUINE_ZOTERO_EXTRA_OVERFLOW_KEYS.has(normKey)) return false;
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
        !isAllowedZoteroExtraKey(key) ||
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
export function isValidValue(val?: unknown): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === "number")
    return !isNaN(val) && Number.isFinite(val) && val !== 0;
  if (typeof val === "boolean") return true;
  if (Array.isArray(val)) return val.some((item) => isValidValue(item));
  if (typeof val === "object")
    return Object.keys(val as Record<string, unknown>).length > 0;
  const s = String(val).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (
    lower === "0" ||
    lower === "0000" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "none" ||
    lower === "nil" ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "{}" ||
    lower === "[]" ||
    lower === "[object object]" ||
    lower === "unknown" ||
    lower.startsWith("unknown ")
  ) {
    return false;
  }
  return true;
}

/**
 * Normalizes a field value into a clean display string, returning empty string for invalid/placeholder values.
 */
export function cleanValue(val?: unknown): string {
  if (!isValidValue(val)) return "";
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as {
            name?: string;
            firstName?: string;
            lastName?: string;
          };
          return (
            obj.name || [obj.firstName, obj.lastName].filter(Boolean).join(" ")
          );
        }
        return String(item);
      })
      .filter(Boolean)
      .join(", ");
  }
  return String(val).trim();
}

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

/**
 * All Zotero Schema v42 field keys promoted from `extraFields` / `metadata` onto top-level `Item`
 * during `mapBackendItemToPaper`. Automatically derived from `ALL_ZOTERO_SCHEMA_FIELDS`.
 */
export const ALL_ZOTERO_PROMOTE_KEYS: readonly string[] = Array.from(
  ALL_ZOTERO_SCHEMA_FIELDS,
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
 * Step 1 of `mapBackendItemToPaper`: Merges `raw.metadata`, `raw.extraFields`, and top-level `raw`
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

  for (const k of ALL_ZOTERO_PROMOTE_KEYS) {
    if (!isValidValue(mapped[k]) && isValidValue(ef[k])) {
      mapped[k] = ef[k];
    }
  }

  return { mapped, ef };
}

/**
 * Step 2 of `mapBackendItemToPaper`: Projects Zotero Schema v42 base fields (`title`, `publicationTitle`,
 * `publisher`, `date`/`year`, `abstract`, `volume`, `pages`, `place`, `authors`) onto top-level `Item` properties.
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

  const resolvedVenue = getPublicationVenue(mapped);
  if (!isValidValue(rec.publicationTitle) && isValidValue(resolvedVenue)) {
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

  const baseProjections: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["abstract", ["abstractNote", "abstract"]],
    ["volume", ["reporterVolume", "codeVolume"]],
    ["pages", ["firstPage", "codePages"]],
  ];
  for (const [targetKey, sourceKeys] of baseProjections) {
    if (!isValidValue(rec[targetKey])) {
      const val = pickFirstValidField(rec, ef, sourceKeys);
      if (isValidValue(val)) {
        mapped[targetKey] = String(val).trim();
      }
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

/**
 * Declaratively normalizes a raw backend item or Zotero Schema v42 record into a canonical UI `Item`,
 * composing `mergeRawItemPartials` and `projectCanonicalBaseFields`.
 */
export function mapBackendItemToPaper(
  raw?: Partial<Item> | Record<string, unknown> | null,
): Item {
  if (!raw || typeof raw !== "object") {
    return {
      id: "",
      title: "Untitled",
      authors: [],
      year: 0,
      createdAt: "",
      updatedAt: "",
    } as unknown as Item;
  }

  const rec = raw as Record<string, unknown>;
  const { mapped, ef } = mergeRawItemPartials(rec);
  projectCanonicalBaseFields(mapped, rec, ef);
  return mapped as unknown as Item;
}

export const mapBackendPaperToItem = mapBackendItemToPaper;

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

const PARSED_EXTRA_STRING_CACHE = new Map<string, Record<string, string>>();
const PARSED_EXTRA_OBJECT_CACHE = new WeakMap<object, Record<string, string>>();
const MAX_PARSED_EXTRA_STRING_CACHE_SIZE = 1024;

/**
 * Parses Zotero's "Extra" field cheater syntax (both `Key: Value` lines and `{:Key: Value}` blocks)
 * into a dictionary supporting both exact, lowercase, and canonical field lookups.
 */
export function parseZoteroExtraField(extra?: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!extra) return result;

  if (typeof extra === "string") {
    const trimmed = extra.trim();
    if (!trimmed) return result;
    const cached = PARSED_EXTRA_STRING_CACHE.get(trimmed);
    if (cached) return { ...cached };
  } else if (typeof extra === "object" && !Array.isArray(extra)) {
    const cached = PARSED_EXTRA_OBJECT_CACHE.get(extra);
    if (cached) return { ...cached };
  }

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
    PARSED_EXTRA_OBJECT_CACHE.set(extra, result);
    return { ...result };
  }

  if (typeof extra !== "string") return result;
  const trimmed = extra.trim();
  if (!trimmed) return result;

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
        if (
          PARSED_EXTRA_STRING_CACHE.size >= MAX_PARSED_EXTRA_STRING_CACHE_SIZE
        ) {
          PARSED_EXTRA_STRING_CACHE.clear();
        }
        PARSED_EXTRA_STRING_CACHE.set(trimmed, result);
        return { ...result };
      }
    } catch {
      // Fall through to line-by-line Zotero Extra parsing
    }
  }

  // 2. Parse inline {:Key: Value} cheater syntax blocks
  const inlineRegex = /\{:([^:}]+):\s*([^}]+)\}/g;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlineRegex.exec(trimmed)) !== null) {
    setKey(inlineMatch[1], inlineMatch[2]);
  }

  // 3. Parse standard Zotero `Key: Value` lines
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

  if (PARSED_EXTRA_STRING_CACHE.size >= MAX_PARSED_EXTRA_STRING_CACHE_SIZE) {
    PARSED_EXTRA_STRING_CACHE.clear();
  }
  PARSED_EXTRA_STRING_CACHE.set(trimmed, result);
  return { ...result };
}

/**
 * Normalizes an uploaded file name to a clean presentation title.
 * Strips file extensions and normalizes dashes/underscores to title case words.
 */
export function cleanFilenameToTitle(filename?: string | null): string {
  if (!filename || typeof filename !== "string") return "Uploaded Document";
  const base = filename
    .replace(/\.[a-zA-Z0-9]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!base) return "Uploaded Document";
  return base
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
