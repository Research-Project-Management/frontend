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
  INTERNAL_AND_DEDICATED_METADATA_KEYS,
  isAllowedItemExtraKey,
  formatExtraDisplay,
  formatAndSanitizeExtraMetadata,
  getItemDisplayDate,
  parseItemExtraField,
} from './metadata-extra';

export {
  mapBackendItem,
  type ProvisionalUploadItemInput,
  createProvisionalUploadItem,
} from './metadata-mapper';
