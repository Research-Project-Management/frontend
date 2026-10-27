/**
 * Domain Metadata Sanitization, Formatting, Extra-Field Parsing & Backend Item Mapping
 */
export {
  isValidValue,
  cleanValue,
  stripLatexMarkup,
  cleanSingleFrontendTag,
  normalizeTags,
  type NormalizedNote,
  cleanNoteContent,
  normalizeNotes,
  cleanAbstractText,
  cleanFilenameToTitle,
} from './metadata-sanitizers';

export {
  getItemDisplayTitle,
  getPublicationVenue,
  formatItemTypeLabel,
  SYSTEM_INTERNAL_METADATA_KEYS,
  INTERNAL_AND_DEDICATED_METADATA_KEYS,
  isSystemInternalExtraKey,
  isAllowedItemExtraKey,
  formatExtraDisplay,
  formatAndSanitizeExtraMetadata,
  stripOrUpdateExtraKeyLine,
  buildExtraMetadataPatch,
  getItemDisplayDate,
  parseItemExtraField,
} from './metadata-extra';

export {
  ALL_SCHEMA_PROMOTE_KEYS,
  hasExplicitUserStateInPayload,
  mapBackendItem,
  preserveMappedItemFlags,
  getAssignedCollectionIds,
  type ProvisionalUploadItemInput,
  createProvisionalUploadItem,
} from './metadata-mapper';
