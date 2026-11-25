/**
 * src/features/editor/subsystems/citation/index.ts
 * Citation Subsystem Public API.
 */

// Model
export {
  parseBibContent,
  parseMultipleBibContents,
  type BibEntry,
} from '@/features/editor/domain/latex/bib-parser';
export {
  isLatexDocument,
  detectDocumentCitationStyle,
  buildBibliographySection,
  injectBibliographyIntoDocument,
} from './model/bibliography';
export {
  resolveCitationScope,
  PERSONAL_LIBRARY_SCOPE,
  type CitationScope,
} from './model/scope';
export { buildRetractedCitationMap } from './model/retraction';
export {
  extractCitationKeys,
  formatInTextCitationPreview,
  formatBibliographyPreview,
  formatShortAuthor,
  isVietnameseAuthorName,
  stripLatexComments,
  formatCitationSnippet,
  formatItemAuthorSummary,
  formatItemToBibtex,
} from './model/formatter';

// UI
export { default as CitationModal } from './ui/CitationModal';

// Extensions
export {
  citationHoverSource,
  latexCitationHoverTooltip,
} from './extensions/citation-hover';
