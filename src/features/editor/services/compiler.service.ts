/**
 * compiler.service.ts
 *
 * Frontend service mirroring Backend CLSI & LaTeX compilation:
 *  - Compile LaTeX (`/api/v1/manuscripts/compile`)
 *  - Preview Compilation (`/api/v1/manuscripts/compile`)
 *  - Word Count (`/api/v1/manuscripts/word-count`)
 *  - Incremental sync (`/api/v1/manuscripts/docs/:rootId/sync-incremental`)
 *  - Compiler Aux Artifacts (`/api/v1/manuscripts/projects/:projectId/artifacts`)
 *
 * Delegates to unified manuscriptService.
 */

import { manuscriptService } from './manuscript.service';
export type {
  CompilerDiagnostic,
  CompileLatexPayload,
  CompileLatexResponse,
  WordCountResponse,
  PreviewCompileResult,
  AuxFileItem,
} from './manuscript.service';

export const flushPageContent = manuscriptService.docs.updateContent;
export const syncIncremental = manuscriptService.docs.syncIncremental;
export const compileLatex = manuscriptService.compiler.compile;
export const fetchWordCount = manuscriptService.compiler.wordCount;
export const compilePreview = manuscriptService.compiler.preview;
export const listAuxFiles = manuscriptService.compiler.listAuxFiles;
export const downloadAuxFileUrl = manuscriptService.compiler.downloadAuxFileUrl;

export const compileService = {
  flushPageContent,
  syncIncremental,
  compileLatex,
  compilePreview,
  fetchWordCount,
  listAuxFiles,
  downloadAuxFileUrl,
};

export const DocumentCompileService = compileService;
