export { useEditorSettingsStore, type LayoutMode, type CompileMode, type LaTeXEngine } from './store/editor-settings.store';
export { useCompileStore } from './store/compile.store';
export { buildRichContext, parseLatexStructure, resolveFileUrl } from './utils/latex';
export {
  parseAiEditResponse,
  validateAiEdits,
  isEditSafe,
  applyAiEdits,
  highlightEditedLines,
  previewAiEdits,
  applyEditsToEditor,
  previewEditsInEditor,
  highlightLines,
  findLatexCommandRange,
  replaceLatexCommandValue,
  tryLocalCommandEdit,
  parseAiResponse,
  validateEdits,
  getEditorEditContext,
  type AiEditPreviewHandle,
  type AiEditResponse,
  type AiEditOperation,
  type AiEditIntent,
  type AiEditValidationResult,
  type LatexCommandRange,
  type ParsedAiResponse,
} from './services/ai-edit.services';
export { flushPageContent, syncIncremental, compileLatex, type CompileLatexPayload } from './services/compile.services';
export { extractPdfMetadataFromFile, type PdfMetadata, extractDoiFromText, parseXmpMetadata, mergeCrossrefMetadata, parsePdfDate, fetchLookupDoi, fetchSearchCrossref, type CrossrefWork } from './services/pdf.services';
export { PageVersionService } from './services/version.services';
export { ProjectHistoryService } from './services/history.services';
export { PageDocumentService, PageFileService } from './services/page-document.services';
export * from './services/comment.services';
export { useEditorTabsStore } from './store/editor-tabs.store';
export { EditorPage, useEditorContext, EditorContext } from './pages/EditorPage';
export { PageContextProvider, usePageContext } from './store/page-context';
export * from './types/document.types';
export * from './hooks/use-pages';
export * from './hooks/use-version';
export * from './hooks/use-history';
