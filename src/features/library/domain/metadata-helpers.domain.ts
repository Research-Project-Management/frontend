/**
 * Re-exports pure metadata & identifier domain helpers for convenience.
 */
export {
  cleanDoi,
  isValidDoi,
  extractArxivId,
  getArxivPdfUrl,
  extractPmid,
  extractPmcId,
  cleanIsbn,
  parseBatchIdentifiersInput,
  cleanPaperTitle,
  normalizeAcademicTitleCase,
  trimUnmatchedClosingBrackets,
  type BatchIdentifierType,
  type ParsedBatchIdentifier,
} from '../domain/identifiers';

export {
  stripLatexMarkup,
  cleanSingleFrontendTag,
  normalizeTags,
  normalizeNotes,
  cleanAbstractText,
  getItemDisplayTitle,
  getPublicationVenue,
  formatItemTypeLabel,
  formatExtraDisplay,
  formatAndSanitizeExtraMetadata,
  isValidValue,
  cleanValue,
  getItemDisplayDate,
  mapBackendItemToPaper,
  mapBackendPaperToItem,
  parseZoteroExtraField,
  type NormalizedNote,
} from '../domain/metadata';

export {
  parseFeedXml,
  mapFeedEntryToCreateItemPayload,
  type FeedFormat,
  type ParsedFeedEntry,
  type CreateLibraryItemFromFeedPayload,
} from './feed-parser.domain';

export {
  resolveOpenAccessLicenseBadge,
  isItemTrashed,
  isItemInMyPublications,
  isItemUnfiled,
  filterItemsBySystemView,
  type LibrarySystemViewId,
  type OpenAccessLicenseBadge,
} from '../domain/system-views.policy';

export {
  ALL_SCHEMA_FIELD_KEYS,
  FIRST_CLASS_ITEM_COLUMNS,
  DIRECT_METADATA_FIELDS,
  FIELD_FALLBACK_CHAINS,
  MULTI_KEY_SYNC_SETTERS,
  INSPECTOR_FIELD_DESCRIPTORS,
  resolveInspectorFieldValue,
  buildInspectorFieldPatch,
  type InspectorFieldDescriptor,
  type FieldLookupSource,
} from '../domain/item-field-schema';

