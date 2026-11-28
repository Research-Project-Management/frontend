/**
 * src/features/editor/subsystems/citation/index.ts
 *
 * Citation Subsystem Public Seam.
 */

// 1. Domain Model & Scope
export {
  resolveCitationScope,
  type CitationScope,
  type CitationScopeInput,
} from './model/scope';
export {
  buildRetractedCitationMap,
  type RetractedItemInfo,
} from './model/retraction';
export {
  formatShortAuthor,
  formatItemToBibtex,
} from './model/formatter';

// 2. UI Presentation Layer
export { CitationModal, type CitationModalProps } from './ui/CitationModal';
export { BibVisualEditor, type BibVisualEditorProps } from './ui/BibVisualEditor';

// 3. CodeMirror Extensions
export { latexCitationHoverTooltip } from './extensions/citation-hover';
