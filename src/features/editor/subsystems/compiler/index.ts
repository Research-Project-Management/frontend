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
} from './coordinator/pipeline';
export {
  useCompileStore,
  selectFilteredCompileDiagnostics,
} from './store/compiler.store';
export {
  createInitialCompilerFsmContext,
  compilerFsmTransition,
  deriveCompileStatus,
  isCompilerFsmRunning,
  type CompilerFsmContext,
} from '@/features/editor/domain/document/compiler-fsm';
export {
  useViewerStore,
} from './store/viewer.store';

// 2. SyncTeX & PDF Intelligence
export {
  type SyncTeXNode,
  type SyncTeXMap,
  resolveForward,
  resolveForwardDetail,
  resolveReverse,
} from './synctex/synctex';
export {
  performRecursiveXyCut,
  computeBoundingBox,
} from './synctex/xy-cut';
export {
  parseDocumentOutline,
  dtoToOutlineEntries,
  cacheBackendOutline,
  type OutlineEntry,
} from './synctex/outline';
export {
  createPdfBlobAndUrl,
  extractDoiFromText,
  parsePdfDate,
} from './synctex/resolver';

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
export { default as PdfViewer } from './ui/pdf/PdfViewer';
export { default as DetachedPdfPlaceholder } from './ui/pdf/DetachedPlaceholder';
export { DetachedPdfViewer } from './ui/pdf/DetachedViewer';
export {
  default as PdfSurface,
  PdfSyncTeXHighlightBox,
  type SynctexHighlightState,
} from './ui/pdf/PdfSurface';
export { default as CompilerLogs } from './ui/logs/LogsPanel';
export { CompileOutcomeCard } from './ui/logs/OutcomeCard';
export { CompileButton } from './ui/CompileButton';
export { default as CompilationErrorBanner } from './ui/ErrorBanner';
export { WordCountModal, default as WordCountDialog } from './ui/WordCountModal';
export {
  resolveProjectFileByLogPath,
} from './hooks/useLogActions';
export { default as PdfToolbar } from './ui/pdf/PdfToolbar';
export { default as PdfFindBar } from './ui/pdf/PdfFindBar';
export { default as PdfZoomControls } from './ui/pdf/PdfZoom';
export { usePdfZoom } from './hooks/usePdfZoom';
export { usePdfSearch, buildPdfSearchRegex, escapePdfSearchRegExp } from './hooks/usePdfSearch';
export { useSynchronizedScroll } from './hooks/useSyncScroll';

// 5. Pre-Compile Flush Barrier
export {
  FlushBarrier,
} from './coordinator/flush-barrier';

// 6. Subsystem Deep Interface Port & Implementation (The Seam)
import {
  compilerCoordinator,
  SnapshotProvider,
} from './coordinator/compiler.coordinator';
import { useCompileStore } from './store/compiler.store';
import { editorCommandBus, resolveEditorScope } from '@/features/editor/core';
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
    const scope = resolveEditorScope();
    const spaceId = scope.spaceId || (scope.rootPageId ? scope.routeSpaceParam : '');
    const pageId = scope.rootPageId || undefined;
    if (spaceId) {
      const res = await compilerCoordinator.resolveReverseRemote(spaceId, page, x, y, pageId);
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

