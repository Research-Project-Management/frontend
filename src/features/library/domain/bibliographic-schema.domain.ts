/**
 * BibliographicSchema Deep Domain Module (Zotero Schema v42)
 *
 * Consolidates the Bibliographic Schema registry, Base Field mappings,
 * derived fallback chains, multi-key write synchronizers, and Extra-field
 * promotion rules into a single cohesive domain facade.
 *
 * Replaces scattered import-time listener side effects with an atomic,
 * versioned `BibliographicSchemaSnapshot` and unified domain operations:
 * - `hydrateBibliographicSchema(payload, options)`
 * - `getBibliographicSchema()`
 * - `resolveBibliographicField(item, fieldKey, context)`
 * - `buildBibliographicFieldPatch(item, fieldKey, value)`
 * - `buildExtraMetadataPatch(item, nextExtraText)`
 * - `mapBackendItem(raw)`
 */

import type {
  Item,
  PreparedInspectorFieldContext,
} from '@/features/library/types/core.types';
import {
  ALL_SCHEMA_FIELD_KEYS,
  BASE_FIELD_MAPPINGS,
  REVERSE_BASE_FIELD_MAPPINGS,
  ITEM_TYPE_FIELDS_MAP,
  ITEM_TYPE_LABELS,
  FIELD_LABELS,
  type SchemaFieldDefinition,
} from '@/features/library/types/item-type-mappings.constants';
import {
  LIBRARY_ITEM_TYPES,
  FIELD_DEFINITIONS,
  getSchemaRegistryVersion,
  updateLibrarySchemaRegistry,
  registerSchemaRegistryUpdateListener,
  normalizeCanonicalItemType,
  getItemTypeDefinition,
  getPrimaryCreatorType,
  getTitleFieldForType,
  getDateFieldForType,
  getVenueFieldForType,
  getPublisherFieldForType,
  type SchemaItemTypeDefinition,
  type LibrarySchemaRegistrySnapshot,
} from '@/features/library/types/item-types.types';
import {
  FIRST_CLASS_ITEM_COLUMNS,
  CANONICAL_FIELD_ALIASES,
  ALLOWED_ITEM_EXTRA_LINE_KEYS,
  DEDICATED_FIELDS_BY_TYPE_MAP,
  INTERNAL_AND_DEDICATED_METADATA_KEYS,
  buildDerivedFieldMappings,
  getDirectExtraAliases,
  isDedicatedFieldForType,
  collectUnmappedFieldsSet,
  getItemDisplayTitle,
  getPublicationVenue,
  getItemDisplayDate,
  formatItemTypeLabel,
  parseValidYear,
} from './metadata-extra-rules.domain';
import {
  prepareInspectorFieldContext,
  resolveInspectorFieldValue,
  buildInspectorFieldPatch,
  buildInverseMetadataPatch,
  buildPreConversionSnapshot,
  MULTI_KEY_SYNC_SETTERS,
} from './item-field-schema.domain';
import {
  INSPECTOR_FIELD_DESCRIPTORS,
  applyCoupledFieldSynchronization,
  type FieldLookupSource,
  type InspectorFieldDescriptor,
} from './item-field-descriptors.domain';
import {
  buildExtraMetadataPatch,
  formatExtraDisplay,
  formatAndSanitizeExtraMetadata,
  parseItemExtraField,
  stripOrUpdateExtraKeyLine,
} from './metadata-extra.domain';
import {
  mapBackendItem,
  ALL_SCHEMA_PROMOTE_KEYS,
  createProvisionalUploadItem,
  getAssignedCollectionIds,
  hasExplicitUserStateInPayload,
} from './metadata.mapper';

export interface BibliographicSchemaSnapshot extends LibrarySchemaRegistrySnapshot {
  readonly baseFieldMappings: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly reverseBaseFieldMappings: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly fieldLabels: Readonly<Record<string, string>>;
  readonly allSchemaFieldKeys: ReadonlySet<string>;
  readonly promoteFieldKeys: readonly string[];
  readonly dedicatedFieldsByType: ReadonlyMap<string, ReadonlySet<string>>;
  readonly fallbackChains: Readonly<
    Record<string, ReadonlyArray<readonly ['p' | 'ef', string]>>
  >;
  readonly syncSetters: Readonly<Record<string, readonly string[]>>;
}

let cachedBibliographicSnapshot: BibliographicSchemaSnapshot | null = null;

function buildBibliographicSchemaSnapshot(): BibliographicSchemaSnapshot {
  const version = getSchemaRegistryVersion();
  const derived = buildDerivedFieldMappings();
  const promoteFieldKeys = Object.freeze(
    Array.from(ALL_SCHEMA_FIELD_KEYS).filter((k) => k !== 'title' && k !== 'extra'),
  );
  const dedicatedMap = new Map<string, ReadonlySet<string>>();
  for (const [type, fields] of Object.entries(ITEM_TYPE_FIELDS_MAP)) {
    dedicatedMap.set(
      type,
      new Set(fields.map((f) => f.toLowerCase().replace(/[\s_-]+/g, ''))),
    );
  }

  return Object.freeze({
    version,
    itemTypes: Object.freeze({ ...LIBRARY_ITEM_TYPES }),
    fieldDefinitions: Object.freeze({ ...FIELD_DEFINITIONS }),
    itemTypeLabels: Object.freeze({ ...ITEM_TYPE_LABELS }),
    baseFieldMappings: Object.freeze({ ...BASE_FIELD_MAPPINGS }),
    reverseBaseFieldMappings: Object.freeze({ ...REVERSE_BASE_FIELD_MAPPINGS }),
    fieldLabels: Object.freeze({ ...FIELD_LABELS }),
    allSchemaFieldKeys: new Set(ALL_SCHEMA_FIELD_KEYS),
    promoteFieldKeys,
    dedicatedFieldsByType: dedicatedMap,
    fallbackChains: Object.freeze({ ...derived.fallbackChains }),
    syncSetters: Object.freeze({ ...derived.syncSetters }),
  });
}

registerSchemaRegistryUpdateListener(() => {
  cachedBibliographicSnapshot = null;
});

/**
 * Returns an immutable, versioned snapshot of the active Zotero v42 Bibliographic Schema,
 * including Base Field mappings, derived fallback chains, and dedicated per-type field sets.
 */
export function getBibliographicSchema(): BibliographicSchemaSnapshot {
  const currentVersion = getSchemaRegistryVersion();
  if (
    !cachedBibliographicSnapshot ||
    cachedBibliographicSnapshot.version !== currentVersion
  ) {
    cachedBibliographicSnapshot = buildBibliographicSchemaSnapshot();
  }
  return cachedBibliographicSnapshot;
}

/**
 * Atomically hydrates the Zotero v42 Bibliographic Schema from a backend `/library/item-types`
 * payload or cached snapshot, refreshing all derived field mappings and returning the new
 * immutable `BibliographicSchemaSnapshot`.
 */
export function hydrateBibliographicSchema(
  data: unknown,
  options?: { persist?: boolean },
): BibliographicSchemaSnapshot {
  updateLibrarySchemaRegistry(data, options);
  cachedBibliographicSnapshot = buildBibliographicSchemaSnapshot();
  return cachedBibliographicSnapshot;
}

/**
 * Subscribes to live schema hydration updates.
 */
export function subscribeBibliographicSchema(listener: () => void): () => void {
  return registerSchemaRegistryUpdateListener(listener);
}

/**
 * Resolves the display value of any Zotero Schema v42 field on a `BibliographicRecord` (`Item`),
 * respecting Base Field aliases, type-specific fallback chains, and `Extra` key-value lines.
 */
export const resolveBibliographicField = resolveInspectorFieldValue;

/**
 * Builds an atomic mutation patch for a `BibliographicRecord` (`Item`) when a field is edited,
 * synchronizing coupled Base Fields, `extraFields`, `Extra` lines, and clearing tombstones.
 */
export const buildBibliographicFieldPatch = buildInspectorFieldPatch;

export {
  // Schema & Type Registry
  ALL_SCHEMA_FIELD_KEYS,
  ALL_SCHEMA_PROMOTE_KEYS,
  FIRST_CLASS_ITEM_COLUMNS,
  CANONICAL_FIELD_ALIASES,
  ALLOWED_ITEM_EXTRA_LINE_KEYS,
  DEDICATED_FIELDS_BY_TYPE_MAP,
  INTERNAL_AND_DEDICATED_METADATA_KEYS,
  MULTI_KEY_SYNC_SETTERS,
  INSPECTOR_FIELD_DESCRIPTORS,
  normalizeCanonicalItemType,
  getItemTypeDefinition,
  getPrimaryCreatorType,
  getTitleFieldForType,
  getDateFieldForType,
  getVenueFieldForType,
  getPublisherFieldForType,
  // Field Resolution & Patching
  prepareInspectorFieldContext,
  resolveInspectorFieldValue,
  buildInspectorFieldPatch,
  applyCoupledFieldSynchronization,
  buildInverseMetadataPatch,
  buildPreConversionSnapshot,
  buildDerivedFieldMappings,
  getDirectExtraAliases,
  isDedicatedFieldForType,
  collectUnmappedFieldsSet,
  // Extra Metadata & Display Helpers
  buildExtraMetadataPatch,
  formatExtraDisplay,
  formatAndSanitizeExtraMetadata,
  parseItemExtraField,
  stripOrUpdateExtraKeyLine,
  getItemDisplayTitle,
  getPublicationVenue,
  getItemDisplayDate,
  formatItemTypeLabel,
  parseValidYear,
  // Backend Item Mapping
  mapBackendItem,
  createProvisionalUploadItem,
  getAssignedCollectionIds,
  hasExplicitUserStateInPayload,
  type SchemaFieldDefinition,
  type SchemaItemTypeDefinition,
  type LibrarySchemaRegistrySnapshot,
  type PreparedInspectorFieldContext,
  type FieldLookupSource,
  type InspectorFieldDescriptor,
};
