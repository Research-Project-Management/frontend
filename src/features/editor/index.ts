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
} from './services/ai-edit.service';
export { flushPageContent, syncIncremental, compileLatex, type CompileLatexPayload } from './services/compile.service';
export { extractPdfMetadataFromFile, type PdfMetadata, extractDoiFromText, parseXmpMetadata, mergeCrossrefMetadata, parsePdfDate, fetchLookupDoi, fetchSearchCrossref, type CrossrefWork } from './services/pdf.service';
export { PageVersionService } from './services/version.service';
export { ProjectHistoryService } from './services/history.service';
export { PageDocumentService, PageFileService } from './services/page-document.service';
export * from './services/comment.service';
export { useEditorTabsStore } from './store/editor-tabs.store';
export { EditorPage, useEditorContext, EditorContext } from './pages/EditorPage';
export { PageContextProvider, usePageContext } from './store/page-context';
export * from './types/document.types';
export * from './hooks/use-page';
export * from './hooks/use-version';
export * from './hooks/use-history';
