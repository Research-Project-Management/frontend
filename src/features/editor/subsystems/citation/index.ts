/**
 * src/features/editor/subsystems/citation/index.ts
 *
 * Citation Subsystem Public Seam & Facade Port (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - BibTeX & BibLaTeX Parsing and Generation.
 * - Citation Key Auto-completion and Renaming Refactor Engine.
 * - Retracted Academic Literature Detection.
 * - Citation Picker Modal and Citation Sidebar Tab Presentation.
 * - CodeMirror 6 Hover Tooltip Extension.
 */

// 1. Models & Pure Domain Algorithms
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
} from './model/bibliography-generator';
export {
  validateCitationKey,
  refactorCitationKeyInBibTeX,
  refactorCitationKeyInLatex,
  refactorCitationKeyAcrossFiles,
  executeProjectCitekeyRefactor,
} from './model/citation-refactor';
export {
  buildRetractedCitationMap,
} from './model/retracted-citations';
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
} from './model/citation-formatter';

// 2. Presentation Layer (Thin Views)
export { default as CitationTab } from './ui/CitationTab';
export {
  default as CitationModal,
  CitationPickerModal,
} from './ui/modals/CitationModal';
export {
  default as RenameCitationModal,
} from './ui/modals/RenameCitationModal';

// 3. Engine Extensions (CodeMirror 6)
export {
  citationHoverSource,
  latexCitationHoverTooltip,
} from './extensions/latex-citation-hover';

