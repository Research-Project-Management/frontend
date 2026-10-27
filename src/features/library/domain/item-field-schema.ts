/**
 * Single Source of Truth for Zotero Schema v42 Field Resolution, Alias Fallback Chains,
 * First-Class Column Mapping, and Atomic Inspector Patch Construction.
 */

import type { Item } from "@/features/library/domain/types/library.types";
import { ALL_SCHEMA_FIELD_KEYS } from "@/features/library/domain/types/item-fields.constants";
import {
  normalizeCanonicalItemType,
  registerSchemaRegistryUpdateListener,
  type SchemaFieldDefinition,
} from "@/features/library/domain/types/item-types.types";
import { cleanDoi, extractArxivId } from "./identifiers";
import { generateCitationKey } from "./citations";
import {
  isValidValue,
  cleanValue,
  parseItemExtraField,
  stripOrUpdateExtraKeyLine,
} from "./metadata";
import {
  FIRST_CLASS_ITEM_COLUMNS,
  CANONICAL_FIELD_ALIASES,
  buildDerivedFieldMappings,
  parseValidYear,
  getDirectExtraAliases,
  type FieldCandidateScorer,
  FIELD_CANDIDATE_SCORERS,
} from "./item-field-scorers.strategy";

export {
  ALL_SCHEMA_FIELD_KEYS,
  FIRST_CLASS_ITEM_COLUMNS,
  CANONICAL_FIELD_ALIASES,
  type FieldCandidateScorer,
  FIELD_CANDIDATE_SCORERS,
};

const DERIVED_FIELD_MAPPINGS = buildDerivedFieldMappings();

export const FIELD_FALLBACK_CHAINS: Record<
  string,
  ReadonlyArray<readonly ["p" | "ef", string]>
> = DERIVED_FIELD_MAPPINGS.fallbackChains;

export const MULTI_KEY_SYNC_SETTERS: Record<string, readonly string[]> =
  DERIVED_FIELD_MAPPINGS.syncSetters;

export const DIRECT_METADATA_FIELDS: Set<string> = new Set<string>([
  ...Array.from(ALL_SCHEMA_FIELD_KEYS).filter((k) => k !== "title" && k !== "extra"),
  ...Array.from(FIRST_CLASS_ITEM_COLUMNS).filter((k) => k !== "title" && k !== "itemType" && k !== "year"),
  ...Object.keys(CANONICAL_FIELD_ALIASES),
  "version",
  "chapter",
  "chapterNumber",
  "statuteNumber",
]);

function refreshDerivedFieldMappings(): void {
  const next = buildDerivedFieldMappings();
  for (const k of Object.keys(FIELD_FALLBACK_CHAINS)) delete FIELD_FALLBACK_CHAINS[k];
  Object.assign(FIELD_FALLBACK_CHAINS, next.fallbackChains);
  for (const k of Object.keys(MULTI_KEY_SYNC_SETTERS)) delete MULTI_KEY_SYNC_SETTERS[k];
  Object.assign(MULTI_KEY_SYNC_SETTERS, next.syncSetters);
  for (const k of ALL_SCHEMA_FIELD_KEYS) {
    if (k !== "title" && k !== "extra") DIRECT_METADATA_FIELDS.add(k);
  }
}

registerSchemaRegistryUpdateListener(refreshDerivedFieldMappings);

export type FieldLookupSource = {
  p: Record<string, unknown>;
  ef: Record<string, unknown>;
  displayDoi: string;
  fieldKey: string;
};

const SUBTYPE_FIELD_KEYS: ReadonlySet<string> = new Set([
  "reporttype",
  "thesistype",
  "manuscripttype",
  "websitetype",
  "lettertype",
  "maptype",
  "presentationtype",
  "posttype",
  "genre",
  "type",
]);

function pickFirst(
  p: Record<string, unknown>,
  ef: Record<string, unknown>,
  entries: ReadonlyArray<readonly ["p" | "ef", string]>,
  fieldKeyLower?: string,
): unknown {
  const isSubtypeField = Boolean(
    fieldKeyLower && SUBTYPE_FIELD_KEYS.has(fieldKeyLower),
  );
  const rawItemType =
    typeof p.itemType === "string" ? p.itemType.trim().toLowerCase() : "";
  const canonicalItemType = rawItemType
    ? normalizeCanonicalItemType(rawItemType).toLowerCase()
    : "";
  const rawConferenceName =
    fieldKeyLower === "proceedingstitle" && canonicalItemType === "conferencepaper"
      ? String(p.conferenceName || ef.conferenceName || "").trim().toLowerCase()
      : "";

  for (const [src, k] of entries) {
    const v = src === "p" ? p[k] : ef[k];
    if (!isValidValue(v)) continue;
    if (isSubtypeField && typeof v === "string") {
      const candidateLower = v.trim().toLowerCase();
      if (
        candidateLower &&
        (candidateLower === rawItemType || candidateLower === canonicalItemType)
      ) {
        continue;
      }
    }
    if (
      rawConferenceName &&
      k === "publicationTitle" &&
      typeof v === "string" &&
      v.trim().toLowerCase() === rawConferenceName &&
      !isValidValue(p.proceedingsTitle) &&
      !isValidValue(ef.proceedingsTitle)
    ) {
      continue;
    }
    return v;
  }
  return undefined;
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

const stripIsoDateSuffix = (rawDate: unknown): string => {
  if (!rawDate || !isValidValue(rawDate)) return "";
  const str = String(rawDate).trim();
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})T/);
  return isoMatch ? isoMatch[1]! : cleanValue(str);
};

const getDateValue = ({ p, ef }: FieldLookupSource): string => {
  const rawDate =
    p.publicationDate ||
    p.date ||
    ef.date ||
    ef.publicationDate ||
    (p.year && Number(p.year) > 0 ? String(p.year) : "");
  return stripIsoDateSuffix(rawDate);
};

const buildMappedDateGetter =
  (
    dateKey: "issueDate" | "dateDecided" | "dateEnacted" | "filingDate",
    fallbackToPubDate = true,
  ) =>
  ({ p, ef }: FieldLookupSource): string => {
    const raw =
      p[dateKey] ||
      ef[dateKey] ||
      (fallbackToPubDate
        ? p.publicationDate ||
          p.date ||
          ef.date ||
          ef.publicationDate ||
          (p.year && Number(p.year) > 0 ? String(p.year) : "")
        : p.date || ef.date);
    return stripIsoDateSuffix(raw);
  };

const buildDatePatch = (
  val: string,
  _item: Item | Partial<Item>,
  currentExtraFields: Record<string, unknown>,
): Partial<Item> & Record<string, unknown> => {
  const finalYear = parseValidYear(val);
  return {
    year: finalYear !== undefined ? finalYear : null,
    publicationDate: val || "",
    date: val || "",
    extraFields: { ...currentExtraFields, date: val || null, publicationDate: val || null },
  };
};

const getPublicationTitleValue = ({ p, ef }: FieldLookupSource): string =>
  cleanValue(
    p.publicationTitle || p.containerTitle || p.journal || p.proceedingsTitle || p.bookTitle || ef.publicationTitle || ef.containerTitle,
  );

const getAccessDateValue = ({ p, ef }: FieldLookupSource): string => {
  const raw = p.accessDate || p.accessedAt || ef.accessDate || ef.accessedAt;
  if (!raw || !isValidValue(raw)) return "";
  const str = String(raw).trim();
  const isoDateMatch = str.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  return isoDateMatch ? isoDateMatch[1]! : cleanValue(str);
};

const getArchiveIdValue = ({ p, ef, fieldKey }: FieldLookupSource): string => {
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
  const isPreprint = normalizeCanonicalItemType(p.itemType as string) === "preprint";
  return isPreprint && clean ? `arXiv:${clean}` : clean;
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
      ...(syncPubDate
        ? {
            publicationDate: val || "",
            date: val || "",
            year: finalYear !== undefined ? finalYear : null,
          }
        : finalYear !== undefined
          ? { year: finalYear }
          : {}),
      extraFields: {
        ...currentExtraFields,
        [dateKey]: val || null,
        ...(syncPubDate
          ? { date: val || null, publicationDate: val || null }
          : {}),
      },
    };
  };

export const INSPECTOR_FIELD_DESCRIPTORS: Record<
  string,
  InspectorFieldDescriptor
> = {
  abstractnote: {
    patch: (val, _item, currentExtraFields) => {
      const cleaned = val.trim();
      return {
        abstractNote: cleaned || "",
        abstract: cleaned || null,
        extraFields: { ...currentExtraFields, abstractNote: cleaned || null, abstract: cleaned || null },
      };
    },
  },
  abstract: {
    patch: (val, _item, currentExtraFields) => {
      const cleaned = val.trim();
      return {
        abstractNote: cleaned || "",
        abstract: cleaned || null,
        extraFields: { ...currentExtraFields, abstractNote: cleaned || null, abstract: cleaned || null },
      };
    },
  },
  pages: {
    get: ({ p, ef }) => {
      const raw = ((p.pages || ef.pages || "") as string).trim();
      return raw
        ? raw.replace(/\s*(?:--+|[\u2010-\u2015\u2212])\s*/g, "-").replace(/\s*-\s*/g, "-")
        : "";
    },
    patch: (val, _item, currentExtraFields) => {
      const cleaned = typeof val === "string"
        ? val.trim().replace(/\s*(?:--+|[\u2010-\u2015\u2212])\s*/g, "-").replace(/\s*-\s*/g, "-")
        : val;
      return {
        pages: cleaned || "",
        extraFields: { ...currentExtraFields, pages: cleaned || null },
      };
    },
  },
  date: { get: getDateValue, patch: buildDatePatch },
  publicationdate: { get: getDateValue, patch: buildDatePatch },
  publicationtitle: { get: getPublicationTitleValue },
  journal: { get: getPublicationTitleValue },
  accessdate: { get: getAccessDateValue },
  accessedat: { get: getAccessDateValue },
  doi: {
    get: ({ p, ef, displayDoi }) =>
      cleanValue(displayDoi || p.doi || p.DOI || ef.doi),
    patch: (val, _item, currentExtraFields) => {
      const cleaned = cleanDoi(val);
      return {
        doi: cleaned || "",
        extraFields: {
          ...currentExtraFields,
          doi: cleaned || null,
          DOI: null,
        },
      };
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
  issuedate: {
    get: buildMappedDateGetter("issueDate", true),
    patch: buildMappedDatePatch("issueDate", true),
  },
  datedecided: {
    get: buildMappedDateGetter("dateDecided", true),
    patch: buildMappedDatePatch("dateDecided", true),
  },
  dateenacted: {
    get: buildMappedDateGetter("dateEnacted", true),
    patch: buildMappedDatePatch("dateEnacted", true),
  },
  filingdate: {
    get: buildMappedDateGetter("filingDate", false),
    patch: buildMappedDatePatch("filingDate", false),
  },
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
    typeof item === "object" && preParsedExtraMap === undefined && preCleanedDoi === undefined;
  if (canUseWeakCache) {
    const cached = PREPARED_ITEM_CONTEXT_CACHE.get(item);
    if (cached) return cached;
  }
  const p = item as Record<string, unknown>;
  const parsedExtraMap = preParsedExtraMap ?? parseItemExtraField(item.extra);
  const rawEf = (item.extraFields as Record<string, unknown>) || {};
  const ef: Record<string, unknown> =
    Object.keys(parsedExtraMap).length > 0 ? { ...parsedExtraMap, ...rawEf } : { ...rawEf };

  for (const [k, v] of Object.entries(rawEf)) {
    if (v === null) {
      for (const alias of getDirectExtraAliases(k)) {
        ef[alias] = null;
        ef[alias.toLowerCase()] = null;
      }
    }
  }

  const isDoiCleared = item.doi === "" && (rawEf.doi === null || rawEf.DOI === null);
  const fallbackDoi = isDoiCleared
    ? ""
    : item.doi || (p.DOI as string | undefined) || (typeof ef.doi === "string" ? ef.doi : undefined);
  const displayDoi = preCleanedDoi !== undefined ? preCleanedDoi : cleanDoi(fallbackDoi);
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
    return cleanValue(pickFirst(p, ef, fallbackChain, keyLower));
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
  const isClearing = !val.trim();
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
      if (
        keyLower === "conferencename" &&
        targetKey === "publicationTitle" &&
        item.itemType === "conferencePaper"
      ) {
        continue;
      }
      patch[targetKey] = val || "";
      if (
        isClearing ||
        SUBTYPE_FIELD_KEYS.has(keyLower) ||
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
    const isSubtype = SUBTYPE_FIELD_KEYS.has(keyLower);
    if (isSubtype) {
      patch.type = val || "";
      patch.genre = val || "";
    }
    if (
      isClearing ||
      isSubtype ||
      key in currentExtraFields ||
      !FIRST_CLASS_ITEM_COLUMNS.has(key)
    ) {
      patch.extraFields = {
        ...currentExtraFields,
        [key]: val || null,
        ...(isSubtype ? { type: val || null, genre: val || null } : {}),
      };
    }
  }

  const directAliases = getDirectExtraAliases(key);
  if (directAliases.length > 0 || patch.extraFields) {
    const nextEf: Record<string, unknown> = {
      ...currentExtraFields,
      ...((patch.extraFields as Record<string, unknown> | undefined) || {}),
    };
    const collapsedKey = keyLower.replace(/[\s_-]+/g, "");
    const effectiveValForEf =
      keyLower === "doi"
        ? cleanDoi(val) || null
        : collapsedKey === "arxivid" ||
            collapsedKey === "archiveid" ||
            collapsedKey === "arxiv"
          ? val.replace(/\s*\[.*?\]\s*$/, "").trim().replace(/^arxiv:\s*/i, "") || null
          : val.trim() || null;

    let aliasMutated = Boolean(patch.extraFields);
    for (const alias of directAliases) {
      if (alias === "DOI" && effectiveValForEf !== null && keyLower === "doi") {
        nextEf.DOI = null;
      } else {
        nextEf[alias] = effectiveValForEf;
      }
      aliasMutated = true;
    }
    for (const existingKey of Object.keys(currentExtraFields)) {
      if (existingKey.toLowerCase().replace(/[\s_-]+/g, "") === collapsedKey) {
        nextEf[existingKey] = effectiveValForEf;
        aliasMutated = true;
      }
    }
    if (aliasMutated) {
      patch.extraFields = nextEf;
    }
  }

  const collapsedKeyForExtra = keyLower.replace(/[\s_-]+/g, "");
  const effectiveExtraLineVal =
    keyLower === "doi"
      ? cleanDoi(val)
      : collapsedKeyForExtra === "arxivid" ||
          collapsedKeyForExtra === "archiveid" ||
          collapsedKeyForExtra === "arxiv"
        ? val.replace(/\s*\[.*?\]\s*$/, "").trim().replace(/^arxiv:\s*/i, "")
        : val.trim();
  const updatedExtraText = stripOrUpdateExtraKeyLine(
    item.extra,
    key,
    effectiveExtraLineVal,
  );
  if (updatedExtraText !== undefined) {
    patch.extra = updatedExtraText;
  }

  if (isClearing && item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)) {
    const clonedMeta: Record<string, unknown> = {
      ...(item.metadata as Record<string, unknown>),
    };
    const keysToClear = new Set<string>([
      key,
      ...(syncTargets || []),
      ...directAliases,
      ...Object.keys(patch).filter((k) => k !== "extraFields" && k !== "metadata" && k !== "itemType" && k !== "extra"),
    ]);
    let metaMutated = false;
    for (const k of keysToClear) {
      if (k in clonedMeta && clonedMeta[k] !== null) {
        clonedMeta[k] = null;
        metaMutated = true;
      }
    }
    if (metaMutated) {
      patch.metadata = clonedMeta;
    }
  }

  if (item.itemType) {
    patch.itemType = item.itemType;
  }

  return patch;
}
