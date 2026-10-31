/**
 * Library Item-Type Registry — Dynamic Backend Schema Consumer & Lightweight Definitions
 * Standardized 100% against Official Zotero Schema v42 (https://api.zotero.org/schema).
 * Single Source of Truth is owned by backend (/api/v1/library/item-types).
 */
import {
  ITEM_TYPE_FIELDS_MAP,
  FIELD_LABELS,
  updateCachedFields,
  rebuildAllSchemaFieldKeys,
  humanizeFieldName,
} from './item-fields.constants';
import {
  SCHEMA_VERSION,
  SCHEMA_SOURCE,
  ALL_ITEM_TYPES_FLAT,
  ITEM_TYPE_LABELS,
  ITEM_TYPE_GROUPS,
  ITEM_TYPE_CATEGORIES,
  BASE_FIELD_MAPPINGS,
  deriveReverseBaseFieldMappings,
  REVERSE_BASE_FIELD_MAPPINGS,
  ALL_CREATOR_TYPES,
  CSL_TYPE_MAP,
  DEFAULT_BIBLIOGRAPHIC_FIELDS,
  ITEM_TYPE_CREATOR_ROLES_MAP,
} from './item-type-mappings.constants';

export {
  ITEM_TYPE_FIELDS_MAP,
  FIELD_LABELS,
  updateCachedFields,
  rebuildAllSchemaFieldKeys,
  humanizeFieldName,
  SCHEMA_VERSION,
  SCHEMA_SOURCE,
  ALL_ITEM_TYPES_FLAT,
  ITEM_TYPE_LABELS,
  ITEM_TYPE_GROUPS,
  ITEM_TYPE_CATEGORIES,
  BASE_FIELD_MAPPINGS,
  deriveReverseBaseFieldMappings,
  REVERSE_BASE_FIELD_MAPPINGS,
  ALL_CREATOR_TYPES,
  CSL_TYPE_MAP,
  DEFAULT_BIBLIOGRAPHIC_FIELDS,
  ITEM_TYPE_CREATOR_ROLES_MAP,
};

export interface SchemaFieldDefinition {
  field: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'url';
  category?: 'core' | 'venue' | 'publication' | 'identifiers' | 'archive' | 'extra';
  mono?: boolean;
  /** Canonical semantic field supplied by Zotero Schema v42 baseField mappings */
  baseField?: string;
  order?: number;
}

export interface SchemaCreatorTypeDefinition {
  creatorType: string;
  label: string;
  primary?: boolean;
}

export type ItemFieldDefinition = SchemaFieldDefinition;
export type CreatorTypeDefinition = SchemaCreatorTypeDefinition;

export interface SchemaItemTypeDefinition {
  itemType: string;
  label: string;
  category?: 'academic' | 'books' | 'articles' | 'legal' | 'media' | 'documents' | 'special';
  primaryCreatorType: string;
  creatorTypes: SchemaCreatorTypeDefinition[];
  fields: SchemaFieldDefinition[];
  isBibliographic?: boolean;
  isSpecial?: boolean;
}

export interface ItemTypeCategoryGroup {
  id: string;
  label: string;
  types: { value: string; label: string }[];
}

export interface RegistryItemTypeDefinition {
  itemType: string;
  label: string;
  category: SchemaItemTypeDefinition['category'];
  primaryCreatorType: string;
  creatorTypes: SchemaCreatorTypeDefinition[];
  fields: Array<{
    key?: string;
    field?: string;
    label: string;
    placeholder?: string;
    type?: SchemaFieldDefinition['type'];
    category?: SchemaFieldDefinition['category'];
    mono?: boolean;
    baseField?: string;
    order?: number;
  }>;
  isBibliographic?: boolean;
  isSpecial?: boolean;
}

/**
 * Returns the primary creator role for an item type per Zotero Schema v42.
 */
export function getPrimaryCreatorType(itemType?: string | null): string {
  if (!itemType) return 'author';
  const canonical = normalizeCanonicalItemType(itemType);
  if (LIBRARY_ITEM_TYPES?.[canonical]?.primaryCreatorType) {
    return LIBRARY_ITEM_TYPES[canonical].primaryCreatorType;
  }
  return (
    ITEM_TYPE_CREATOR_ROLES_MAP[canonical]?.[0] ||
    ITEM_TYPE_CREATOR_ROLES_MAP[itemType]?.[0] ||
    'author'
  );
}

const MONO_FIELD_KEYS = new Set([
  'volume',
  'issue',
  'pages',
  'seriesNumber',
  'date',
  'filingDate',
  'accessDate',
  'DOI',
  'ISBN',
  'ISSN',
  'PMID',
  'PMCID',
  'archiveID',
  'patentNumber',
  'applicationNumber',
  'reportNumber',
  'citationKey',
  'url',
  'numPages',
]);

const FIELD_CATEGORY_BY_LOWER_KEY: Record<string, NonNullable<SchemaFieldDefinition['category']>> = {
  title: 'core',
  casename: 'core',
  nameofact: 'core',
  subject: 'core',
  abstractnote: 'core',
  shorttitle: 'core',
  publicationtitle: 'venue',
  publisher: 'venue',
  place: 'venue',
  university: 'venue',
  institution: 'venue',
  conferencename: 'venue',
  meetingname: 'venue',
  booktitle: 'venue',
  proceedingstitle: 'venue',
  websitetitle: 'venue',
  blogtitle: 'venue',
  forumtitle: 'venue',
  dictionarytitle: 'venue',
  encyclopediatitle: 'venue',
  programtitle: 'venue',
  sessiontitle: 'venue',
  court: 'venue',
  issuingauthority: 'venue',
  organization: 'venue',
  company: 'venue',
  repository: 'venue',
  distributor: 'venue',
  studio: 'venue',
  network: 'venue',
  label: 'venue',
  doi: 'identifiers',
  isbn: 'identifiers',
  issn: 'identifiers',
  pmid: 'identifiers',
  pmcid: 'identifiers',
  archiveid: 'identifiers',
  patentnumber: 'identifiers',
  docketnumber: 'identifiers',
  publiclawnumber: 'identifiers',
  billnumber: 'identifiers',
  documentnumber: 'identifiers',
  citationkey: 'identifiers',
  url: 'identifiers',
  archive: 'archive',
  archivelocation: 'archive',
  librarycatalog: 'archive',
  callnumber: 'archive',
  extra: 'extra',
  rights: 'extra',
};

export function buildStaticFieldsForType(itemType: string): SchemaFieldDefinition[] {
  const keys = ITEM_TYPE_FIELDS_MAP[itemType] || [];
  const reverseMap = REVERSE_BASE_FIELD_MAPPINGS[itemType] || {};
  return keys.map((field, idx) => {
    const fieldName = String(field);
    const fieldLower = fieldName.toLowerCase();
    return {
      field: fieldName,
      label: FIELD_LABELS[fieldName] || humanizeFieldName(fieldName),
      type: fieldLower.includes('date')
        ? 'date'
        : fieldName === 'url'
          ? 'url'
          : fieldName === 'abstractNote' || fieldName === 'extra'
            ? 'textarea'
            : 'text',
      category: FIELD_CATEGORY_BY_LOWER_KEY[fieldLower] || 'publication',
      mono: MONO_FIELD_KEYS.has(fieldName),
      baseField: reverseMap[fieldName] || BASE_FIELD_MAPPINGS[itemType]?.[fieldName],
      order: idx + 1,
    };
  });
}

export const LIBRARY_ITEM_TYPES: Record<string, SchemaItemTypeDefinition> = {};
export const FIELD_DEFINITIONS: Record<string, SchemaFieldDefinition> = {};

// Pre-populate statically with all official Zotero Schema v42 fields & creator roles
for (const t of ALL_ITEM_TYPES_FLAT) {
  const roleKeys = ITEM_TYPE_CREATOR_ROLES_MAP[t.value] || ['author', 'contributor', 'editor', 'translator'];
  const primaryRole = roleKeys[0] || 'author';
  const group = ITEM_TYPE_GROUPS.find((g) => g.types.some((ty) => ty.value === t.value));
  const category = (group?.id ?? 'documents') as SchemaItemTypeDefinition['category'];
  const typeFields = buildStaticFieldsForType(t.value);

  LIBRARY_ITEM_TYPES[t.value] = {
    itemType: t.value,
    label: t.label,
    category,
    primaryCreatorType: primaryRole,
    creatorTypes: roleKeys.map((roleKey, idx) => ({
      creatorType: roleKey,
      label: ALL_CREATOR_TYPES[roleKey] || humanizeFieldName(roleKey),
      ...(idx === 0 ? { primary: true } : {}),
    })),
    fields: typeFields.length > 0 ? typeFields : DEFAULT_BIBLIOGRAPHIC_FIELDS,
    isBibliographic: true,
    isSpecial: false,
  };

  for (const f of typeFields) {
    if (!FIELD_DEFINITIONS[f.field]) {
      FIELD_DEFINITIONS[f.field] = f;
    }
  }
}

export const ITEM_TYPE_DEFINITIONS = LIBRARY_ITEM_TYPES;
export const LIBRARY_ITEM_TYPE_KEYS = Object.keys(LIBRARY_ITEM_TYPES);
for (const f of DEFAULT_BIBLIOGRAPHIC_FIELDS) {
  if (!FIELD_DEFINITIONS[f.field]) {
    FIELD_DEFINITIONS[f.field] = f;
  }
}

/**
 * Dynamically updates the in-memory schema registry with live data received
 * from backend GET /api/v1/library/item-types.
 */
interface SchemaRegistryPayload {
  baseFieldMappings?: Record<string, Record<string, string>>;
  reverseBaseFieldMappings?: Record<string, Record<string, string>>;
  creatorRoles?: Record<string, string>;
  cslTypeMap?: Record<string, string>;
  itemTypes?: unknown;
  data?: unknown;
}

export type SchemaPersistenceListener = (data: unknown) => void;
let persistenceListener: SchemaPersistenceListener | null = null;
let schemaRegistryVersion = 1;
const schemaRegistryUpdateListeners = new Set<() => void>();

export function setSchemaPersistenceListener(listener: SchemaPersistenceListener | null): void {
  persistenceListener = listener;
}

export function getSchemaRegistryVersion(): number {
  return schemaRegistryVersion;
}

export function registerSchemaRegistryUpdateListener(listener: () => void): () => void {
  schemaRegistryUpdateListeners.add(listener);
  return () => {
    schemaRegistryUpdateListeners.delete(listener);
  };
}

function notifySchemaRegistryUpdated(): void {
  schemaRegistryVersion += 1;
  rebuildAllSchemaFieldKeys();
  for (const listener of schemaRegistryUpdateListeners) {
    listener();
  }
}

export function updateLibrarySchemaRegistry(
  data: unknown,
  options?: { persist?: boolean },
): void {
  if (!data) return;
  const shouldPersist = options?.persist ?? true;

  // Handle case where data is directly an array of item types
  if (Array.isArray(data)) {
    const mapped = mapRegistryItemTypes(data);
    updateCachedFields(mapped);
    if (shouldPersist && persistenceListener) {
      persistenceListener(data);
    }
    for (const def of mapped) {
      LIBRARY_ITEM_TYPES[def.itemType] = def;
      ITEM_TYPE_LABELS[def.itemType] = def.label;
      for (const field of def.fields) {
        if (!FIELD_DEFINITIONS[field.field]) {
          FIELD_DEFINITIONS[field.field] = field;
        }
      }
    }
    notifySchemaRegistryUpdated();
    return;
  }

  if (typeof data !== 'object') return;
  const payload = data as SchemaRegistryPayload;

  if (payload.baseFieldMappings) {
    Object.assign(BASE_FIELD_MAPPINGS, payload.baseFieldMappings);
    Object.assign(
      REVERSE_BASE_FIELD_MAPPINGS,
      deriveReverseBaseFieldMappings(BASE_FIELD_MAPPINGS),
    );
  }
  if (payload.reverseBaseFieldMappings) {
    Object.assign(REVERSE_BASE_FIELD_MAPPINGS, payload.reverseBaseFieldMappings);
  }
  if (payload.creatorRoles) {
    Object.assign(ALL_CREATOR_TYPES, payload.creatorRoles);
  }
  if (payload.cslTypeMap) {
    Object.assign(CSL_TYPE_MAP, payload.cslTypeMap);
  }

  const rawTypes = payload.itemTypes || payload.data;
  if (Array.isArray(rawTypes)) {
    const mapped = mapRegistryItemTypes(rawTypes);
    updateCachedFields(mapped);
    if (shouldPersist && persistenceListener) {
      persistenceListener(payload);
    }
    for (const def of mapped) {
      LIBRARY_ITEM_TYPES[def.itemType] = def;
      ITEM_TYPE_LABELS[def.itemType] = def.label;
      for (const field of def.fields) {
        if (!FIELD_DEFINITIONS[field.field]) {
          FIELD_DEFINITIONS[field.field] = field;
        }
      }
    }
  }
  notifySchemaRegistryUpdated();
}

const CSL_TO_ZOTERO_TYPE_ALIASES: Record<string, string> = {
  'article-journal': 'journalArticle',
  'paper-conference': 'conferencePaper',
  'chapter': 'bookSection',
  'post-weblog': 'blogPost',
  'entry-dictionary': 'dictionaryEntry',
  'entry-encyclopedia': 'encyclopediaArticle',
  'article-magazine': 'magazineArticle',
  'article-newspaper': 'newspaperArticle',
  'motion_picture': 'film',
  'legal_case': 'case',
  'software': 'computerProgram',
  'speech': 'presentation',
  'legislation': 'statute',
};

export function normalizeCanonicalItemType(itemType?: string | null): string {
  if (!itemType) return 'journalArticle';
  const trimmed = itemType.trim();
  if (LIBRARY_ITEM_TYPES[trimmed]) return trimmed;
  if (CSL_TO_ZOTERO_TYPE_ALIASES[trimmed]) return CSL_TO_ZOTERO_TYPE_ALIASES[trimmed];
  const lower = trimmed.toLowerCase();
  if (CSL_TO_ZOTERO_TYPE_ALIASES[lower]) return CSL_TO_ZOTERO_TYPE_ALIASES[lower];
  return trimmed;
}

/**
 * Retrieves the canonical SchemaItemTypeDefinition for a given item type.
 * If not yet loaded from backend, creates a clean synthetic definition.
 */
export function getItemTypeDefinition(itemType?: string | null): SchemaItemTypeDefinition | null {
  if (!itemType) return null;
  const canonical = normalizeCanonicalItemType(itemType);
  if (LIBRARY_ITEM_TYPES[canonical]) {
    return LIBRARY_ITEM_TYPES[canonical];
  }

  const label = ITEM_TYPE_LABELS[canonical] || canonical.replace(/([A-Z])/g, ' $1').trim();
  const primaryCreatorType = getPrimaryCreatorType(canonical);

  const fallbackDef: SchemaItemTypeDefinition = {
    itemType: canonical,
    label,
    category: 'academic',
    primaryCreatorType,
    creatorTypes: [
      { creatorType: primaryCreatorType, label: ALL_CREATOR_TYPES[primaryCreatorType] || 'Author', primary: true },
      { creatorType: 'contributor', label: 'Contributor' },
      { creatorType: 'editor', label: 'Editor' },
      { creatorType: 'translator', label: 'Translator' },
    ],
    fields:
      buildStaticFieldsForType(canonical).length > 0
        ? buildStaticFieldsForType(canonical)
        : DEFAULT_BIBLIOGRAPHIC_FIELDS,
    isBibliographic: true,
    isSpecial: false,
  };

  return fallbackDef;
}

/**
 * Checks whether a creator role is valid for a given item type per Zotero Schema v42.
 */
export function isValidCreatorType(itemType: string, creatorType: string): boolean {
  const canonical = normalizeCanonicalItemType(itemType);
  const def = LIBRARY_ITEM_TYPES[canonical];
  if (!def) return creatorType === 'author' || creatorType === 'contributor' || creatorType === 'editor';
  return def.creatorTypes.some((c) => c.creatorType === creatorType);
}

/**
 * Determines the type-specific title field for an item type based on Schema v42 baseFieldMappings
 * (e.g., `case` -> `caseName`, `statute` -> `nameOfAct`, `email` -> `subject`).
 */
export function getTitleFieldForType(itemType?: string | null): string {
  if (!itemType) return 'title';
  const canonical = normalizeCanonicalItemType(itemType);
  return BASE_FIELD_MAPPINGS[canonical]?.title || 'title';
}

/**
 * Determines the type-specific date field for an item type based on Schema v42 baseFieldMappings
 * (e.g., `case` -> `dateDecided`, `statute` -> `dateEnacted`, `patent` -> `issueDate`).
 */
export function getDateFieldForType(itemType?: string | null): string {
  if (!itemType) return 'date';
  const canonical = normalizeCanonicalItemType(itemType);
  return BASE_FIELD_MAPPINGS[canonical]?.date || 'date';
}

/**
 * Determines the type-specific venue field for an item type based on Schema v42 baseFieldMappings.
 */
export function getVenueFieldForType(itemType?: string | null): string {
  if (!itemType) return 'publicationTitle';
  const canonical = normalizeCanonicalItemType(itemType);
  const mapping = BASE_FIELD_MAPPINGS[canonical];
  if (canonical === 'presentation') return 'meetingName';
  if (mapping?.publicationTitle) {
    return mapping.publicationTitle;
  }
  if (mapping?.publisher) {
    return mapping.publisher;
  }
  if (mapping?.authority) {
    return mapping.authority;
  }
  return 'publicationTitle';
}

export function getPublisherFieldForType(itemType?: string | null): string {
  if (!itemType) return 'publisher';
  const canonical = normalizeCanonicalItemType(itemType);
  const mapping = BASE_FIELD_MAPPINGS[canonical];
  return mapping?.publisher || mapping?.authority || 'publisher';
}

/**
 * Converts the server-owned registry payload from GET /api/v1/library/item-types
 * into strongly-typed SchemaItemTypeDefinition[].
 */
export function mapRegistryItemTypes(value: unknown): SchemaItemTypeDefinition[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): SchemaItemTypeDefinition[] => {
    if (!entry || typeof entry !== 'object') return [];
    const type = entry as RegistryItemTypeDefinition;
    if (type.isBibliographic === false || !type.itemType || !type.label) {
      return [];
    }

    const fields: SchemaFieldDefinition[] = Array.isArray(type.fields)
      ? type.fields
          .filter((field) => field && typeof (field.key || field.field) === 'string')
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((field): SchemaFieldDefinition => {
            const fieldName = (field.key || field.field) as string;
            return {
              field: fieldName,
              label: field.label || fieldName,
              placeholder: field.placeholder,
              type: field.type || 'text',
              category: field.category || 'publication',
              mono: Boolean(field.mono),
              baseField: field.baseField,
              order: field.order,
            };
          })
      : [];

    return [
      {
        itemType: type.itemType,
        label: type.label,
        category: type.category || 'documents',
        primaryCreatorType: type.primaryCreatorType || 'author',
        creatorTypes: Array.isArray(type.creatorTypes) ? type.creatorTypes : [],
        fields,
        isBibliographic: Boolean(type.isBibliographic ?? true),
        isSpecial: Boolean(type.isSpecial),
      },
    ];
  });
}
