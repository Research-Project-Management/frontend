/**
 * src/features/editor/subsystems/compiler/index.ts
 *
 * Compiler & PDF Preview Subsystem Public Seam & Facade Port (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Asynchronous TeX Compilation Pipeline & Pre-Compile Flush Barrier.
 * - PDF.js Canvas Surface & Synchronized Scrolling.
 * - Bidirectional SyncTeX Spatial Coordinate Mapping (XY-Cut Algorithm).
 * - LaTeX Log Parser, Warning Filters & Badbox Extraction.
 */

// 1. Coordinators & Stores
export {
  compilerCoordinator,
  CompilerCoordinator,
  SnapshotProvider,
  buildPageStoreFilePaths,
} from './coordinator/compiler.coordinator';
export {
  CompilePipeline,
  type CompilerPort,
  type CompileExecutionOptions,
} from './coordinator/compile-pipeline';
export {
  useCompileStore,
  selectFilteredCompileDiagnostics,
} from './coordinator/compiler.store';
export {
  createInitialCompilerFsmContext,
  compilerFsmTransition,
  deriveCompileStatus,
  isCompilerFsmRunning,
  type CompilerFsmContext,
} from '@/features/editor/domain/document/compiler-fsm';
export {
  useViewerStore,
} from './coordinator/viewer.store';

// 2. SyncTeX & PDF Intelligence
export {
  type SyncTeXNode,
  type SyncTeXMap,
  resolveForward,
  resolveForwardDetail,
  resolveReverse,
  parseSyncTeX,
  buildKdTree2D,
} from './synctex/synctex-index';
export {
  performRecursiveXyCut,
  computeBoundingBox,
} from './synctex/xy-cut';
export {
  extractPdfBookmarks,
  extractOutlineFromContent,
  parseDocumentOutline,
  dtoToOutlineEntries,
  cacheBackendOutline,
  OUTLINE_INDENT,
  type OutlineEntry,
} from './synctex/pdf-outline';
export {
  createPdfBlobAndUrl,
  extractDoiFromText,
  parsePdfDate,
} from './synctex/pdf-resolver';

// 3. Log Parsing & Diagnostic Filtering
export {
  parseLatexLog,
  type LogEntry,
  type ParsedLog,
} from '@/features/editor/domain/latex/compiler-logs-parser';
export {
  filterDiagnostics,
  shouldSuppressWarning,
  type WarningFilterOptions,
} from '@/features/editor/domain/latex/warning-filter';

// 4. Presentation Layer (Thin Views & Controls)
export { default as PdfViewer } from './ui/PdfViewer';
export { default as DetachedPdfPlaceholder } from './ui/DetachedPdfPlaceholder';
export {
  default as PdfSurface,
  PdfSyncTeXHighlightBox,
  type SynctexHighlightState,
} from './ui/PdfSurface';
export { default as CompilerLogs } from './ui/CompilerLogs';
export { CompileOutcomeCard } from './ui/logs/CompileOutcomeCard';
export { CompileButton } from './ui/CompileButton';
export { default as CompilationErrorBanner } from './ui/CompilationErrorBanner';
export {
  resolveProjectFileByLogPath,
} from './ui/hooks/useLogViewerActions';
export { default as PdfToolbar } from './ui/PdfToolbar';
export { default as PdfFindBar } from './ui/PdfFindBar';
export { default as PdfZoomControls } from './ui/PdfZoomControls';
export { usePdfZoom } from './ui/hooks/usePdfZoom';
export { usePdfSearch, buildPdfSearchRegex, escapePdfSearchRegExp } from './ui/hooks/usePdfSearch';
export { useSynchronizedScroll } from './ui/hooks/useSynchronizedScroll';

// 5. Pre-Compile Flush Barrier
export {
  FlushBarrier,
} from './coordinator/flush-barrier';

// 6. Subsystem Deep Interface Port & Implementation (The Seam)
import {
  compilerCoordinator,
  SnapshotProvider,
} from './coordinator/compiler.coordinator';
import { useCompileStore } from './coordinator/compiler.store';
import { editorCommandBus, usePageStore } from '@/features/editor/core';
import { extractProjectId, extractSpaceId } from '@/features/editor/domain/types/core.types';
import type { ProjectCompilationSnapshot } from '@/features/editor/domain/document/compilation-snapshot';

export interface CompileIntent {
  mode?: 'full' | 'fast';
  reason?: 'manual-button' | 'keyboard-shortcut' | 'auto-compile' | 'external-trigger' | 'manual' | 'auto' | 'shortcut';
  targetFile?: string;
  forceSync?: boolean;
  forceClean?: boolean;
  draft?: boolean;
  onThumbnailGenerated?: (dataUrl: string) => void;
}

export interface CompilationOutcome {
  status: 'success' | 'error' | 'aborted';
  pdfUrl?: string;
  synctexGz?: string;
  errorCount: number;
  warningCount: number;
  durationMs: number;
}

export interface CompilerSubsystemPort {
  readonly name: 'compiler';
  compile(intent?: CompileIntent): Promise<CompilationOutcome>;
  abort(): void;
  jumpToPdf(file: string, line: number): Promise<boolean>;
  jumpToSource(page: number, x: number, y: number): Promise<{ file: string; line: number } | null>;
  getSnapshot?(): ProjectCompilationSnapshot;
}

export const compilerSubsystem: CompilerSubsystemPort = {
  name: 'compiler',
  async compile(intent?: CompileIntent): Promise<CompilationOutcome> {
    const startTime = performance.now();
    const isDraft = intent?.draft ?? (intent?.mode === 'fast');
    const success = await compilerCoordinator.compile({
      draft: isDraft,
      forceClean: intent?.forceClean ?? intent?.forceSync,
      reason: intent?.reason || 'manual',
      onThumbnailGenerated: intent?.onThumbnailGenerated,
    });
    const durationMs = Math.round(performance.now() - startTime);
    const compileStatus = useCompileStore.getState().compileStatus;
    const status: 'success' | 'error' | 'aborted' =
      success
        ? 'success'
        : compileStatus === 'idle' || compileStatus === 'aborted'
          ? 'aborted'
          : 'error';

    return {
      status,
      pdfUrl: useCompileStore.getState().pdfUrl || undefined,
      errorCount: compilerCoordinator.getDiagnosticsCount('error'),
      warningCount: compilerCoordinator.getDiagnosticsCount('warning'),
      durationMs,
    };
  },
  abort(): void {
    compilerCoordinator.stop();
  },
  async jumpToPdf(file: string, line: number): Promise<boolean> {
    const target = compilerCoordinator.resolveForward(line, file);
    if (target !== null) {
      editorCommandBus.dispatch({ type: 'viewer:goto-page', page: target });
      return true;
    }
    return false;
  },
  async jumpToSource(page: number, x: number, y: number): Promise<{ file: string; line: number } | null> {
    const activeDoc = usePageStore.getState().getActiveDocument();
    const projectId =
      extractSpaceId(activeDoc) ||
      usePageStore.getState().spaceId ||
      usePageStore.getState().projectId ||
      '';
    if (projectId) {
      const res = await compilerCoordinator.resolveReverseRemote(projectId, page, x, y);
      if (res && res.sourcePath) {
        return { file: res.sourcePath, line: res.line };
      }
    }
    const local = compilerCoordinator.resolveReverse(0.5, page, x, y);
    if (local && local.sourcePath) {
      return { file: local.sourcePath, line: local.line };
    }
    return null;
  },
  getSnapshot(): ProjectCompilationSnapshot {
    return SnapshotProvider.createSnapshot();
  },
};

