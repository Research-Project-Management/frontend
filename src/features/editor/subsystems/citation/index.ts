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
  type BuildBibliographyOptions,
  type InjectBibliographyResult,
} from './model/bibliography-generator';
export {
  validateCitationKey,
  refactorCitationKeyInBibTeX,
  refactorCitationKeyInLatex,
  refactorCitationKeyAcrossFiles,
  executeProjectCitekeyRefactor,
  type ValidateKeyResult,
  type RefactorFileResult,
  type ProjectRefactorResult,
} from './model/citation-refactor';
export {
  buildRetractedCitationMap,
  type RetractedItemInfo,
} from './model/retracted-citations';
export {
  LATEX_CITE_REGEX,
  PANDOC_BRACKET_REGEX,
  INLINE_CITEKEY_REGEX,
  extractCitationKeys,
  formatInTextCitationPreview,
  formatBibliographyPreview,
  formatShortAuthor,
  isVietnameseAuthorName,
  stripLatexComments,
  stripCodeBlocks,
  formatCitationSnippet,
  formatBibEntryAuthorSummary,
  formatItemAuthorSummary,
  formatItemToBibtex,
  formatBibEntryToBibtex,
  cleanAbstractText,
  detectCitationTrigger,
  type CitationTriggerFormat,
  type CitationTriggerContext,
} from './model/citation-formatter';
export {
  citationLookupSchema,
  type CitationLookupInput,
} from './model/citation.schema';

// 2. Presentation Layer (Thin Views)
export { default as CitationTab } from './ui/CitationTab';
export {
  default as CitationPickerModal,
  type CitationPickerModalProps,
  type CitationStyle,
} from './ui/modals/CitationPickerModal';
export {
  default as RenameCitationModal,
  type RenameCitationModalProps,
} from './ui/modals/RenameCitationModal';
export { CitationPickerCard } from './ui/modals/CitationPickerCard';
export { useCitationPickerActions } from './ui/modals/useCitationPickerActions';

// 3. Engine Extensions (CodeMirror 6)
export {
  citationHoverSource,
  latexCitationHoverTooltip,
} from './extensions/latex-citation-hover';

