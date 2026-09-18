/**
 * Library Item-Type Registry — Frontend Canonical Definitions & Offline Cache
 * Standardized 100% against Official Zotero Schema v42 (https://api.zotero.org/schema).
 * Single Source of Truth backed by backend /api/v1/library/item-types and zotero-schema-fallback.json.
 */

import fallbackData from './data/zotero-schema-fallback.json';

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
  category: 'academic' | 'books' | 'articles' | 'legal' | 'media' | 'documents' | 'special';
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

// ── Schema v42 Constants & Mappings ──────────────────────────────────────────

export const SCHEMA_VERSION = fallbackData.version || 42;
export const SCHEMA_SOURCE = fallbackData.source || 'zotero-schema-v42';

export const BASE_FIELD_MAPPINGS: Record<string, Record<string, string>> =
  (fallbackData as any).baseFieldMappings || {};

export const REVERSE_BASE_FIELD_MAPPINGS: Record<string, Record<string, string>> =
  (fallbackData as any).reverseBaseFieldMappings || {};

export const ALL_CREATOR_TYPES: Record<string, string> =
  (fallbackData as any).creatorRoles || {};

export const CSL_TYPE_MAP: Record<string, string> =
  (fallbackData as any).cslTypeMap || {};

// Transform compiled fallback items to SchemaItemTypeDefinition
const RAW_ITEM_TYPES = (fallbackData as any).itemTypes || {};

export const LIBRARY_ITEM_TYPES: Record<string, SchemaItemTypeDefinition> = {};
export const ITEM_TYPE_LABELS: Record<string, string> = {};
export const ALL_ITEM_TYPES_FLAT: { value: string; label: string }[] = [];

for (const [typeKey, rawType] of Object.entries(RAW_ITEM_TYPES) as [string, any][]) {
  const fields: SchemaFieldDefinition[] = (rawType.fields || []).map((f: any) => ({
    field: f.key || f.field,
    label: f.label || f.key || f.field,
    type: f.type || 'text',
    category: f.category || 'publication',
    mono: Boolean(f.mono),
    baseField: f.baseField,
    order: f.order,
  }));

  const def: SchemaItemTypeDefinition = {
    itemType: typeKey,
    label: rawType.label || typeKey,
    category: rawType.category || 'documents',
    primaryCreatorType: rawType.primaryCreatorType || 'author',
    creatorTypes: rawType.creatorTypes || [],
    fields,
    isBibliographic: rawType.isBibliographic !== false,
    isSpecial: Boolean(rawType.isSpecial),
  };

  LIBRARY_ITEM_TYPES[typeKey] = def;
  ITEM_TYPE_LABELS[typeKey] = def.label;

  if (def.isBibliographic) {
    ALL_ITEM_TYPES_FLAT.push({
      value: typeKey,
      label: def.label,
    });
  }
}

ALL_ITEM_TYPES_FLAT.sort((a, b) => a.label.localeCompare(b.label));

export const FIELD_DEFINITIONS: Record<string, SchemaFieldDefinition> = {};
for (const it of Object.values(LIBRARY_ITEM_TYPES)) {
  for (const f of it.fields) {
    if (!FIELD_DEFINITIONS[f.field]) {
      FIELD_DEFINITIONS[f.field] = f;
    }
  }
}

export const ITEM_TYPE_GROUPS: ItemTypeCategoryGroup[] = [
  {
    id: 'academic',
    label: 'Academic & Scientific',
    types: [
      { value: 'journalArticle', label: 'Journal Article' },
      { value: 'conferencePaper', label: 'Conference Paper' },
      { value: 'preprint', label: 'Preprint' },
      { value: 'thesis', label: 'Thesis' },
      { value: 'report', label: 'Report' },
      { value: 'dataset', label: 'Dataset' },
      { value: 'presentation', label: 'Presentation' },
      { value: 'standard', label: 'Standard' },
    ],
  },
  {
    id: 'books',
    label: 'Books & Sections',
    types: [
      { value: 'book', label: 'Book' },
      { value: 'bookSection', label: 'Book Section' },
      { value: 'dictionaryEntry', label: 'Dictionary Entry' },
      { value: 'encyclopediaArticle', label: 'Encyclopedia Article' },
      { value: 'manuscript', label: 'Manuscript' },
    ],
  },
  {
    id: 'articles',
    label: 'Articles & Web Content',
    types: [
      { value: 'magazineArticle', label: 'Magazine Article' },
      { value: 'newspaperArticle', label: 'Newspaper Article' },
      { value: 'webpage', label: 'Web Page' },
      { value: 'blogPost', label: 'Blog Post' },
      { value: 'forumPost', label: 'Forum Post' },
    ],
  },
  {
    id: 'legal',
    label: 'Legal & Patents',
    types: [
      { value: 'patent', label: 'Patent' },
      { value: 'statute', label: 'Statute' },
      { value: 'bill', label: 'Bill' },
      { value: 'case', label: 'Case' },
      { value: 'hearing', label: 'Hearing' },
    ],
  },
  {
    id: 'media_docs',
    label: 'Media & Documents',
    types: [
      { value: 'document', label: 'Document' },
      { value: 'computerProgram', label: 'Computer Program' },
      { value: 'film', label: 'Film' },
      { value: 'videoRecording', label: 'Video Recording' },
      { value: 'audioRecording', label: 'Audio Recording' },
      { value: 'podcast', label: 'Podcast' },
      { value: 'radioBroadcast', label: 'Radio Broadcast' },
      { value: 'tvBroadcast', label: 'TV Broadcast' },
      { value: 'interview', label: 'Interview' },
      { value: 'letter', label: 'Letter' },
      { value: 'email', label: 'E-mail' },
      { value: 'instantMessage', label: 'Instant Message' },
      { value: 'map', label: 'Map' },
      { value: 'artwork', label: 'Artwork' },
    ],
  },
];

export const ITEM_TYPE_DEFINITIONS = LIBRARY_ITEM_TYPES;
export const ITEM_TYPE_CATEGORIES = ITEM_TYPE_GROUPS;
export const LIBRARY_ITEM_TYPE_KEYS = Object.keys(LIBRARY_ITEM_TYPES);

// ── DRY Schema Helpers ───────────────────────────────────────────────────────

/**
 * Retrieves the canonical SchemaItemTypeDefinition for a given item type.
 * Falls back to null if completely unknown.
 */
export function getItemTypeDefinition(itemType?: string | null): SchemaItemTypeDefinition | null {
  if (!itemType) return null;
  return LIBRARY_ITEM_TYPES[itemType] ?? null;
}

/**
 * Returns the primary creator role for an item type per Zotero Schema v42.
 * (e.g. 'inventor' for patent, 'programmer' for computerProgram, 'director' for film, 'author' for journalArticle)
 */
export function getPrimaryCreatorType(itemType?: string | null): string {
  if (!itemType) return 'author';
  const def = LIBRARY_ITEM_TYPES[itemType];
  return def?.primaryCreatorType || 'author';
}

/**
 * Checks whether a creator role is valid for a given item type per Zotero Schema v42.
 */
export function isValidCreatorType(itemType: string, creatorType: string): boolean {
  const def = LIBRARY_ITEM_TYPES[itemType];
  if (!def) return creatorType === 'author' || creatorType === 'contributor';
  return def.creatorTypes.some((c) => c.creatorType === creatorType);
}

/**
 * Determines the type-specific venue field for an item type based on Schema v42 baseFieldMappings.
 * e.g.:
 * - 'conferencePaper' -> 'proceedingsTitle'
 * - 'bookSection' -> 'bookTitle'
 * - 'webpage' -> 'websiteTitle'
 * - 'blogPost' -> 'blogTitle'
 * - 'dictionaryEntry' -> 'dictionaryTitle'
 * - 'encyclopediaArticle' -> 'encyclopediaTitle'
 * - other types with publicationTitle -> 'publicationTitle'
 */
export function getVenueFieldForType(itemType?: string | null): string {
  if (!itemType) return 'publicationTitle';
  const mapping = BASE_FIELD_MAPPINGS[itemType];
  if (mapping?.publicationTitle) {
    return mapping.publicationTitle;
  }
  const def = LIBRARY_ITEM_TYPES[itemType];
  if (def?.fields.some((f) => f.field === 'publicationTitle')) {
    return 'publicationTitle';
  }
  if (itemType === 'preprint' || itemType === 'dataset') {
    return 'repository';
  }
  return 'publicationTitle';
}

/**
 * Determines the type-specific publisher/institution field for an item type.
 * e.g.:
 * - 'preprint' -> 'repository'
 * - 'thesis' -> 'university'
 * - 'report' -> 'institution'
 * - 'computerProgram' -> 'company'
 * - 'audioRecording' -> 'label'
 * - 'film' / 'tvBroadcast' -> 'distributor' / 'studio' / 'network'
 * - standard bibliographic -> 'publisher'
 */
export function getPublisherFieldForType(itemType?: string | null): string {
  if (!itemType) return 'publisher';
  const mapping = BASE_FIELD_MAPPINGS[itemType];
  if (mapping?.publisher) {
    return mapping.publisher;
  }
  return 'publisher';
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
