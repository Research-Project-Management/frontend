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
import { cleanDoi } from "./identifiers";
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
  getDirectExtraAliases,
  type FieldCandidateScorer,
  FIELD_CANDIDATE_SCORERS,
} from "./item-field-scorers.strategy";
import { applyCoupledFieldSynchronization } from "./item-field-coupling.domain";
import {
  type FieldLookupSource,
  type InspectorFieldDescriptor,
  INSPECTOR_FIELD_DESCRIPTORS,
} from "./item-field-descriptors.domain";

export {
  ALL_SCHEMA_FIELD_KEYS,
  FIRST_CLASS_ITEM_COLUMNS,
  CANONICAL_FIELD_ALIASES,
  type FieldCandidateScorer,
  FIELD_CANDIDATE_SCORERS,
  applyCoupledFieldSynchronization,
  type FieldLookupSource,
  type InspectorFieldDescriptor,
  INSPECTOR_FIELD_DESCRIPTORS,
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
 * Synchronizes both top-level properties, coupled Zotero type-specific fields, and `extraFields`
 * so non-column Zotero fields and existing `extraFields` entries stay 100% consistent.
 */
export function buildInspectorFieldPatch(
  itemOrType: Item | Partial<Item> | Record<string, unknown> | string,
  fieldDefOrKey: SchemaFieldDefinition | { field: string } | string,
  val: string,
  maybeItem?: Item | Partial<Item> | Record<string, unknown>,
): Partial<Item> & Record<string, unknown> {
  const item: Partial<Item> & Record<string, unknown> =
    typeof itemOrType === "string"
      ? { ...(maybeItem || {}), itemType: itemOrType }
      : ((itemOrType || {}) as Partial<Item> & Record<string, unknown>);
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

  applyCoupledFieldSynchronization(item, key, val, patch);

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
      if (
        existingKey.toLowerCase().replace(/[\s_-]+/g, "") === collapsedKey &&
        !(existingKey in ((patch.extraFields as Record<string, unknown> | undefined) || {}))
      ) {
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
    const currentMeta = item.metadata as Record<string, unknown>;
    const clearedMetaTombstones: Record<string, unknown> = {};
    const keysToClear = new Set<string>([
      key,
      ...(syncTargets || []),
      ...directAliases,
      ...Object.keys(patch).filter((k) => k !== "extraFields" && k !== "metadata" && k !== "itemType" && k !== "extra"),
    ]);
    let metaMutated = false;
    for (const k of keysToClear) {
      if (k in currentMeta && currentMeta[k] !== null) {
        clearedMetaTombstones[k] = null;
        metaMutated = true;
      }
    }
    if (metaMutated) {
      patch.metadata = clearedMetaTombstones;
    }
  }

  if (item.itemType) {
    patch.itemType = item.itemType;
  }

  return patch;
}

/**
 * Canonical coupled-field update builder for Inspector edits (alias for `buildInspectorFieldPatch`).
 */
export function buildCoupledFieldUpdates(
  item: Partial<Item> | Record<string, unknown>,
  fieldKey: string,
  value: string,
): Partial<Item> & Record<string, unknown> {
  return buildInspectorFieldPatch(item, fieldKey, value);
}
