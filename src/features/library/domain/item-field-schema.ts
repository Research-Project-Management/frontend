/**
 * Single Source of Truth for Zotero Schema v42 Field Resolution, Alias Fallback Chains,
 * First-Class Column Mapping, and Atomic Inspector Patch Construction.
 *
 *
 * Embodying KISS, DRY, and SOLID:
 * - `ALL_SCHEMA_FIELD_KEYS` is derived automatically from `INITIAL_ITEM_TYPE_FIELDS_MAP`.
 * - `FIELD_FALLBACK_CHAINS` and `MULTI_KEY_SYNC_SETTERS` are derived automatically from
 *   `BASE_FIELD_MAPPINGS` (`item-types.types.ts`) + `CANONICAL_FIELD_ALIASES`, eliminating
 *   hundreds of lines of manual per-field repetition and guaranteeing automatic co-occurring
 *   field isolation (`place` vs `eventPlace` on `conferencePaper`, `place` vs `country` on `patent`,
 *   `publisher` vs `organization` on `standard`).
 */

import type { Item } from "@/features/library/domain/types/library.types";
import { ALL_SCHEMA_FIELD_KEYS } from "@/features/library/domain/types/item-fields.constants";
import {
  BASE_FIELD_MAPPINGS,
  normalizeCanonicalItemType,
  type SchemaFieldDefinition,
} from "@/features/library/domain/types/item-types.types";
import { cleanDoi, extractArxivId } from "./identifiers";
import { generateCitationKey } from "./citations";
import { isValidValue, cleanValue, parseItemExtraField } from "./metadata";

export { ALL_SCHEMA_FIELD_KEYS };

/**
 * First-class columns on the backend Prisma `Item` table.
 */
export const FIRST_CLASS_ITEM_COLUMNS: ReadonlySet<string> = new Set([
  "title",
  "abstractNote",
  "publicationTitle",
  "journalAbbreviation",
  "volume",
  "issue",
  "pages",
  "numberOfPages",
  "publisher",
  "place",
  "edition",
  "series",
  "seriesTitle",
  "seriesNumber",
  "doi",
  "isbn",
  "issn",
  "pmid",
  "pmcid",
  "arxivId",
  "url",
  "openAccessPdfUrl",
  "year",
  "publicationDate",
  "date",
  "accessDate",
  "itemType",
  "language",
  "license",
  "archive",
  "archiveLocation",
  "callNumber",
  "libraryCatalog",
  "citationKey",
  "shortTitle",
  "citationCount",
  "referenceCount",
]);

/**
 * Universal bidirectional field aliases between Zotero Schema v42 field keys and
 * canonical `Item` columns.
 */
export const CANONICAL_FIELD_ALIASES: Record<string, readonly string[]> = {
  abstractNote: ["abstractNote", "abstract"],
  abstract: ["abstractNote", "abstract"],
  journalAbbreviation: ["journalAbbreviation", "journalAbbr"],
  journalAbbr: ["journalAbbreviation", "journalAbbr"],
  publicationTitle: ["publicationTitle", "journal"],
  journal: ["publicationTitle", "journal"],
  accessDate: ["accessDate", "accessedAt"],
  accessedAt: ["accessDate", "accessedAt"],
  rights: ["license", "rights"],
  license: ["license", "rights"],
  ISBN: ["isbn", "ISBN"],
  isbn: ["isbn", "ISBN"],
  ISSN: ["issn", "ISSN"],
  issn: ["issn", "ISSN"],
  PMID: ["pmid", "PMID"],
  pmid: ["pmid", "PMID"],
  PMCID: ["pmcid", "PMCID"],
  pmcid: ["pmcid", "PMCID"],
  DOI: ["doi", "DOI"],
  doi: ["doi", "DOI"],
  archiveID: ["archiveID", "archiveId", "arxivId"],
  archiveId: ["archiveID", "archiveId", "arxivId"],
  arxivId: ["archiveID", "archiveId", "arxivId"],
  citationKey: ["citationKey"],
  citeKey: ["citationKey"],
  numPages: ["numberOfPages", "numPages"],
  numberOfPages: ["numberOfPages", "numPages"],
  versionNumber: ["versionNumber", "version"],
  version: ["versionNumber", "version"],
  meetingName: ["meetingName", "conferenceName"],
  reporter: ["reporter", "publicationTitle"],
};

/**
 * Base field -> Prisma column expansions when projecting Zotero `BASE_FIELD_MAPPINGS`
 * (e.g. `authority` also maps to `publisher` unless `publisher` is a separate co-occurring field on the item type;
 * `number` also maps to `issue`; `type` also maps to `genre` and `type`).
 */
const BASE_FIELD_SYNC_EXPANSIONS: Record<string, readonly string[]> = {
  title: ["title"],
  publicationTitle: ["publicationTitle"],
  publisher: ["publisher"],
  authority: ["authority", "publisher"],
  place: ["place"],
  date: ["publicationDate", "date"],
  volume: ["volume"],
  pages: ["pages"],
  number: ["number", "issue"],
  type: ["genre", "type"],
  status: ["status"],
};

/**
 * Fields that co-occur with a base field on at least one Zotero Schema v42 item type
 * and therefore must not overwrite that base field on write:
 * - `conferencePaper` has both `place` and `eventPlace`
 * - `patent` has both `place` and `country`
 * - `standard` has both `publisher` and `organization`
 * - `report` has `reportNumber` -> `number` (without overwriting `issue`)
 * - `webpage` / `blogPost` has `websiteType` -> `type`
 */
const WRITE_SYNC_OVERRIDES: Record<string, readonly string[]> = {
  eventplace: ["eventPlace"],
  country: ["country"],
  organization: ["organization", "authority"],
  reportnumber: ["reportNumber", "number"],
  websitetype: ["websiteType"],
};

/**
 * Automatically derives `MULTI_KEY_SYNC_SETTERS` and `FIELD_FALLBACK_CHAINS` from
 * `BASE_FIELD_MAPPINGS` (`item-types.types.ts`) and `CANONICAL_FIELD_ALIASES`.
 */
function buildDerivedFieldMappings(): {
  syncSetters: Record<string, readonly string[]>;
  fallbackChains: Record<string, ReadonlyArray<readonly ["p" | "ef", string]>>;
} {
  const syncSetters: Record<string, readonly string[]> = {};
  const concreteToBaseField = new Map<string, string>();

  for (const mapping of Object.values(BASE_FIELD_MAPPINGS)) {
    for (const [baseField, concreteField] of Object.entries(mapping)) {
      if (concreteField && !concreteToBaseField.has(concreteField)) {
        concreteToBaseField.set(concreteField, baseField);
      }
    }
  }

  // 1. Project every concrete mapped field -> [concreteField, ...baseFieldExpansions]
  for (const [concreteField, baseField] of concreteToBaseField.entries()) {
    const lower = concreteField.toLowerCase();
    if (WRITE_SYNC_OVERRIDES[lower]) {
      syncSetters[lower] = WRITE_SYNC_OVERRIDES[lower]!;
      continue;
    }
    const expansions = BASE_FIELD_SYNC_EXPANSIONS[baseField] || [baseField];
    const targets = Array.from(new Set([concreteField, ...expansions]));
    syncSetters[lower] = targets;
  }

  // 2. Apply universal bidirectional aliases
  for (const [fieldKey, aliases] of Object.entries(CANONICAL_FIELD_ALIASES)) {
    syncSetters[fieldKey.toLowerCase()] = aliases;
  }
  for (const [lowerKey, overrideTargets] of Object.entries(
    WRITE_SYNC_OVERRIDES,
  )) {
    syncSetters[lowerKey] = overrideTargets;
  }
  syncSetters.authority = ["issuingAuthority", "authority", "publisher"];

  // 3. Build read fallback chains automatically from all schema fields + concrete fields + base fields + aliases
  const fallbackChains: Record<
    string,
    ReadonlyArray<readonly ["p" | "ef", string]>
  > = {};

  const addChain = (
    key: string,
    entries: ReadonlyArray<readonly ["p" | "ef", string]>,
  ) => {
    const seen = new Set<string>();
    const deduped: Array<readonly ["p" | "ef", string]> = [];
    for (const [src, prop] of entries) {
      const id = `${src}:${prop}`;
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push([src, prop]);
      }
    }
    fallbackChains[key.toLowerCase()] = deduped;
  };

  for (const schemaField of ALL_SCHEMA_FIELD_KEYS) {
    addChain(schemaField, [
      ["p", schemaField],
      ["ef", schemaField],
    ]);
  }

  for (const [concreteField, baseField] of concreteToBaseField.entries()) {
    const expansions = BASE_FIELD_SYNC_EXPANSIONS[baseField] || [baseField];
    addChain(concreteField, [
      ["p", concreteField],
      ["ef", concreteField],
      ...expansions.map((b): readonly ["p" | "ef", string] => ["p", b]),
      ...expansions.map((b): readonly ["p" | "ef", string] => ["ef", b]),
    ]);
  }

  for (const [fieldKey, aliases] of Object.entries(CANONICAL_FIELD_ALIASES)) {
    addChain(fieldKey, [
      ...aliases.map((a): readonly ["p" | "ef", string] => ["p", a]),
      ...aliases.map((a): readonly ["p" | "ef", string] => ["ef", a]),
    ]);
  }

  // Specialized multi-source read chains for container/venue/place/date fields
  addChain("booktitle", [
    ["p", "bookTitle"],
    ["p", "publicationTitle"],
    ["p", "containerTitle"],
    ["p", "proceedingsTitle"],
    ["ef", "bookTitle"],
  ]);
  addChain("proceedingstitle", [
    ["p", "proceedingsTitle"],
    ["p", "publicationTitle"],
    ["p", "containerTitle"],
    ["p", "bookTitle"],
    ["ef", "proceedingsTitle"],
  ]);
  addChain("sessiontitle", [
    ["p", "sessionTitle"],
    ["ef", "sessionTitle"],
  ]);
  addChain("publisher", [
    ["p", "publisher"],
    ["p", "university"],
    ["p", "institution"],
    ["ef", "publisher"],
  ]);
  addChain("university", [
    ["p", "university"],
    ["p", "publisher"],
    ["p", "institution"],
    ["ef", "university"],
  ]);
  addChain("institution", [
    ["p", "institution"],
    ["p", "publisher"],
    ["p", "university"],
    ["ef", "institution"],
  ]);
  addChain("authority", [
    ["p", "issuingAuthority"],
    ["ef", "issuingAuthority"],
    ["p", "authority"],
    ["p", "publisher"],
  ]);
  addChain("place", [
    ["p", "place"],
    ["ef", "place"],
    ["p", "eventPlace"],
  ]);
  addChain("eventplace", [
    ["p", "eventPlace"],
    ["ef", "eventPlace"],
    ["p", "place"],
  ]);
  addChain("country", [
    ["p", "country"],
    ["ef", "country"],
    ["p", "place"],
  ]);
  addChain("filingdate", [
    ["p", "filingDate"],
    ["ef", "filingDate"],
    ["p", "date"],
  ]);
  addChain("prioritydate", [
    ["p", "priorityDate"],
    ["ef", "priorityDate"],
  ]);

  return { syncSetters, fallbackChains };
}

const DERIVED_FIELD_MAPPINGS = buildDerivedFieldMappings();

export const FIELD_FALLBACK_CHAINS: Record<
  string,
  ReadonlyArray<readonly ["p" | "ef", string]>
> = DERIVED_FIELD_MAPPINGS.fallbackChains;

export const MULTI_KEY_SYNC_SETTERS: Record<string, readonly string[]> =
  DERIVED_FIELD_MAPPINGS.syncSetters;

/**
 * Fields backed by first-class Item columns or standard Zotero Schema v42 fields.
 * Derived automatically from `ALL_SCHEMA_FIELD_KEYS` + `FIRST_CLASS_ITEM_COLUMNS` + common backend aliases.
 */
export const DIRECT_METADATA_FIELDS: Set<string> = new Set<string>([
  ...Array.from(ALL_SCHEMA_FIELD_KEYS).filter(
    (k) => k !== "title" && k !== "extra",
  ),
  ...Array.from(FIRST_CLASS_ITEM_COLUMNS).filter(
    (k) => k !== "title" && k !== "itemType" && k !== "year",
  ),
  ...Object.keys(CANONICAL_FIELD_ALIASES),
  "chapter",
  "chapterNumber",
  "statuteNumber",
]);

export type FieldLookupSource = {
  p: Record<string, unknown>;
  ef: Record<string, unknown>;
  displayDoi: string;
  fieldKey: string;
};

function pickFirst(
  p: Record<string, unknown>,
  ef: Record<string, unknown>,
  entries: ReadonlyArray<readonly ["p" | "ef", string]>,
): unknown {
  for (const [src, k] of entries) {
    const v = src === "p" ? p[k] : ef[k];
    if (isValidValue(v)) return v;
  }
  return undefined;
}

function parseValidYear(val: string): number | undefined {
  const yearMatch = val.match(/(?:^|[^\d])(1[7-9]\d{2}|20\d{2})(?:[^\d]|$)/);
  const parsedYear = yearMatch
    ? parseInt(yearMatch[1]!, 10)
    : parseInt(val, 10);
  return !isNaN(parsedYear) && parsedYear >= 1000 && parsedYear <= 2999
    ? parsedYear
    : undefined;
}

export interface InspectorFieldDescriptor {
  get?: (ctx: FieldLookupSource) => string;
  patch?: (
    val: string,
    item: Item | Partial<Item>,
    currentExtraFields: Record<string, unknown>,
  ) => Partial<Item> & Record<string, unknown>;
  formatDisplay?: (rawVal: string) => string;
}

const formatCountDisplay = (rawVal: string): string => {
  if (!rawVal || isNaN(Number(rawVal))) return rawVal;
  return Number(rawVal) > 0
    ? new Intl.NumberFormat("en-US").format(Number(rawVal))
    : "";
};

const buildCountPatch =
  (propKey: "citationCount" | "referenceCount") =>
  (
    val: string,
    _item: Item | Partial<Item>,
    currentExtraFields: Record<string, unknown>,
  ): Partial<Item> & Record<string, unknown> => {
    const parsedCount = parseInt(val.replace(/,/g, ""), 10);
    const validCount = isNaN(parsedCount) ? null : parsedCount;
    return {
      [propKey]: validCount,
      extraFields: { ...currentExtraFields, [propKey]: validCount },
    };
  };

const getDateValue = ({ p, ef }: FieldLookupSource): string => {
  const rawDate =
    p.publicationDate ||
    (p.year && Number(p.year) > 0 ? String(p.year) : "") ||
    p.date ||
    ef.date ||
    ef.publicationDate;
  if (!rawDate) return "";
  const isoMatch = String(rawDate).match(/^(\d{4}-\d{2}-\d{2})T/);
  return isoMatch ? isoMatch[1]! : cleanValue(rawDate);
};

const buildDatePatch = (
  val: string,
): Partial<Item> & Record<string, unknown> => {
  const finalYear = parseValidYear(val);
  return {
    year: finalYear !== undefined ? finalYear : null,
    publicationDate: val || "",
    date: val || "",
  };
};

const getPublicationTitleValue = ({ p, ef }: FieldLookupSource): string =>
  cleanValue(
    p.publicationTitle ||
      p.containerTitle ||
      p.journal ||
      p.proceedingsTitle ||
      p.bookTitle ||
      ef.publicationTitle ||
      ef.containerTitle,
  );

const getAccessDateValue = ({ p, ef }: FieldLookupSource): string => {
  const raw = p.accessDate || p.accessedAt || ef.accessDate || ef.accessedAt;
  if (!raw || !isValidValue(raw)) return "";
  const str = String(raw).trim();
  const isoDateMatch = str.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  return isoDateMatch ? isoDateMatch[1]! : cleanValue(str);
};

const getArchiveIdValue = ({ p, ef }: FieldLookupSource): string => {
  const raw = cleanValue(
    p.archiveId ||
      p.archiveID ||
      p.arxivId ||
      ef.archiveId ||
      ef.archiveID ||
      ef.arxivId ||
      extractArxivId(p.url as string) ||
      extractArxivId(p.callNumber as string),
  );
  if (!raw) return "";
  const clean = raw
    .replace(/^arxiv:\s*/i, "")
    .replace(/\s*\[.*?\]\s*$/, "")
    .trim();
  return normalizeCanonicalItemType(p.itemType as string) === "preprint" &&
    clean
    ? `arXiv:${clean}`
    : clean;
};

const buildArchiveIdPatch = (
  val: string,
  _item: Item | Partial<Item>,
  currentExtraFields: Record<string, unknown>,
): Partial<Item> & Record<string, unknown> => {
  const cleanVal = val.replace(/\s*\[.*?\]\s*$/, "").trim();
  const rawArxiv = cleanVal.replace(/^arxiv:\s*/i, "");
  return {
    arxivId: rawArxiv || "",
    archiveID: cleanVal || "",
    extraFields: {
      ...currentExtraFields,
      arxivId: rawArxiv || null,
      archiveID: cleanVal || null,
    },
  };
};

const getCitationKeyValue = ({ p }: FieldLookupSource): string =>
  cleanValue(p.citationKey || generateCitationKey(p));

const buildNumPagesPatch = (
  val: string,
  _item: Item | Partial<Item>,
  currentExtraFields: Record<string, unknown>,
): Partial<Item> & Record<string, unknown> => {
  const parsed = parseInt(val, 10);
  const validNum = isNaN(parsed) ? val || null : parsed;
  return {
    numberOfPages: validNum,
    extraFields: {
      ...currentExtraFields,
      numPages: validNum,
      numberOfPages: validNum,
    },
  };
};

const buildMappedDatePatch =
  (
    dateKey: "issueDate" | "dateDecided" | "dateEnacted" | "filingDate",
    syncPubDate = true,
  ) =>
  (
    val: string,
    _item: Item | Partial<Item>,
    currentExtraFields: Record<string, unknown>,
  ): Partial<Item> & Record<string, unknown> => {
    const finalYear = parseValidYear(val);
    return {
      [dateKey]: val || "",
      ...(syncPubDate ? { publicationDate: val || "", date: val || "" } : {}),
      ...(finalYear ? { year: finalYear } : {}),
      extraFields: { ...currentExtraFields, [dateKey]: val || null },
    };
  };

export const INSPECTOR_FIELD_DESCRIPTORS: Record<
  string,
  InspectorFieldDescriptor
> = {
  date: { get: getDateValue, patch: buildDatePatch },
  publicationdate: { get: getDateValue, patch: buildDatePatch },
  publicationtitle: { get: getPublicationTitleValue },
  journal: { get: getPublicationTitleValue },
  accessdate: { get: getAccessDateValue },
  accessedat: { get: getAccessDateValue },
  doi: {
    get: ({ p, ef, displayDoi }) =>
      cleanValue(displayDoi || p.doi || p.DOI || ef.doi),
    patch: (val) => {
      const cleaned = cleanDoi(val);
      return { doi: cleaned || "" };
    },
  },
  archiveid: { get: getArchiveIdValue, patch: buildArchiveIdPatch },
  arxivid: { get: getArchiveIdValue, patch: buildArchiveIdPatch },
  arxiv: { get: getArchiveIdValue, patch: buildArchiveIdPatch },
  citationkey: { get: getCitationKeyValue },
  citekey: { get: getCitationKeyValue },
  repository: {
    get: ({ p, ef }) =>
      cleanValue(
        p.repository ||
          ef.repository ||
          (normalizeCanonicalItemType(p.itemType as string) === "preprint"
            ? p.publisher || p.publicationTitle
            : ""),
      ),
    patch: (val, item, currentExtraFields) => ({
      repository: val || "",
      ...(item?.itemType === "preprint" ? {} : { publisher: val || "" }),
      extraFields: { ...currentExtraFields, repository: val || null },
    }),
  },
  websitetitle: {
    get: ({ p, ef, fieldKey }) =>
      cleanValue(
        p[fieldKey] || ef[fieldKey] || p.publicationTitle || p.containerTitle,
      ),
  },
  blogtitle: {
    get: ({ p, ef, fieldKey }) =>
      cleanValue(
        p[fieldKey] || ef[fieldKey] || p.publicationTitle || p.containerTitle,
      ),
  },
  citationcount: {
    get: ({ p, ef }) => {
      const count = p.citationCount ?? ef.citationCount;
      return count != null && Number(count) > 0 ? String(count) : "";
    },
    patch: buildCountPatch("citationCount"),
    formatDisplay: formatCountDisplay,
  },
  referencecount: {
    get: ({ p, ef }) => {
      const count = p.referenceCount ?? ef.referenceCount;
      return count != null && Number(count) > 0 ? String(count) : "";
    },
    patch: buildCountPatch("referenceCount"),
    formatDisplay: formatCountDisplay,
  },
  numpages: { patch: buildNumPagesPatch },
  numberofpages: { patch: buildNumPagesPatch },
  issuedate: { patch: buildMappedDatePatch("issueDate", true) },
  datedecided: { patch: buildMappedDatePatch("dateDecided", true) },
  dateenacted: { patch: buildMappedDatePatch("dateEnacted", true) },
  filingdate: { patch: buildMappedDatePatch("filingDate", false) },
};

export interface PreparedInspectorFieldContext {
  p: Record<string, unknown>;
  ef: Record<string, unknown>;
  displayDoi: string;
}

const PREPARED_ITEM_CONTEXT_CACHE = new WeakMap<
  object,
  PreparedInspectorFieldContext
>();

/**
 * Pre-computes the merged `extra` + `extraFields` lookup dictionary and `displayDoi`
 * once per `Item` ($O(1)$ per field lookup instead of re-parsing `item.extra` $O(F)$ times).
 */
export function prepareInspectorFieldContext(
  item: Item | Partial<Item> | undefined,
  preParsedExtraMap?: Record<string, string>,
  preCleanedDoi?: string,
): PreparedInspectorFieldContext | null {
  if (!item) return null;
  const canUseWeakCache =
    typeof item === "object" &&
    preParsedExtraMap === undefined &&
    preCleanedDoi === undefined;
  if (canUseWeakCache) {
    const cached = PREPARED_ITEM_CONTEXT_CACHE.get(item);
    if (cached) return cached;
  }
  const p = item as Record<string, unknown>;
  const parsedExtraMap = preParsedExtraMap ?? parseItemExtraField(item.extra);
  const rawEf = (item.extraFields as Record<string, unknown>) || {};
  const ef: Record<string, unknown> =
    Object.keys(parsedExtraMap).length > 0
      ? { ...parsedExtraMap, ...rawEf }
      : rawEf;
  const displayDoi =
    preCleanedDoi ?? cleanDoi(item.doi || (p.DOI as string | undefined) || parsedExtraMap.doi);
  const ctx: PreparedInspectorFieldContext = { p, ef, displayDoi };
  if (canUseWeakCache) {
    PREPARED_ITEM_CONTEXT_CACHE.set(item, ctx);
  }
  return ctx;
}

/**
 * Pure helper to resolve the display value of any Zotero schema field from an Item.
 */
export function resolveInspectorFieldValue(
  item: Item | Partial<Item> | undefined,
  fieldKey: string,
  precomputedContext?: PreparedInspectorFieldContext | null,
): string {
  if (!item) return "";
  const ctx = precomputedContext ?? prepareInspectorFieldContext(item);
  if (!ctx) return "";
  const { p, ef, displayDoi } = ctx;
  const keyLower = fieldKey.toLowerCase();

  const descriptor = INSPECTOR_FIELD_DESCRIPTORS[keyLower];
  if (descriptor?.get) {
    return descriptor.get({ p, ef, displayDoi, fieldKey });
  }

  const fallbackChain = FIELD_FALLBACK_CHAINS[keyLower];
  if (fallbackChain) {
    return cleanValue(pickFirst(p, ef, fallbackChain));
  }

  return cleanValue(
    p[fieldKey] ??
      ef[fieldKey] ??
      ef[keyLower] ??
      (p.customFields as Record<string, unknown> | undefined)?.[fieldKey],
  );
}

/**
 * Pure helper to construct an atomic update patch for an Item when a dynamic Inspector field is saved.
 * Synchronizes both top-level properties and `extraFields` so non-column Zotero fields and
 * existing `extraFields` entries stay 100% consistent.
 */
export function buildInspectorFieldPatch(
  item: Item | Partial<Item>,
  fieldDefOrKey: SchemaFieldDefinition | { field: string } | string,
  val: string,
): Partial<Item> & Record<string, unknown> {
  const key =
    typeof fieldDefOrKey === "string" ? fieldDefOrKey : fieldDefOrKey.field;
  const keyLower = key.toLowerCase();
  const currentExtraFields =
    (item.extraFields as Record<string, unknown> | undefined) || {};

  let patch: Partial<Item> & Record<string, unknown> = {};
  const descriptor = INSPECTOR_FIELD_DESCRIPTORS[keyLower];
  const syncTargets = MULTI_KEY_SYNC_SETTERS[keyLower];

  if (descriptor?.patch) {
    patch = descriptor.patch(val, item, currentExtraFields);
  } else if (syncTargets) {
    const updatedEf: Record<string, unknown> = { ...currentExtraFields };
    let shouldSyncExtraFields = false;
    for (const targetKey of syncTargets) {
      patch[targetKey] = val || "";
      if (
        targetKey in currentExtraFields ||
        !FIRST_CLASS_ITEM_COLUMNS.has(targetKey)
      ) {
        updatedEf[targetKey] = val || null;
        shouldSyncExtraFields = true;
      }
    }
    if (shouldSyncExtraFields) {
      patch.extraFields = updatedEf;
    }
  } else {
    patch = { [key]: val || "" };
    if (key in currentExtraFields || !FIRST_CLASS_ITEM_COLUMNS.has(key)) {
      patch.extraFields = { ...currentExtraFields, [key]: val || null };
    }
  }

  if (item.itemType) {
    patch.itemType = item.itemType;
  }

  return patch;
}
