/**
 * compiler-lifecycle.coordinator.ts
 *
 * Headless Compiler & SyncTeX Lifecycle Coordinator (Application / Domain Layer).
 *
 * Responsibilities:
 * - Single source of truth for the active compilation lifecycle (IDLE -> COMPILING -> SYNCING -> SUCCESS / ERROR / ABORTED).
 * - Cancels in-flight compile jobs when a new compile is triggered (via AbortController).
 * - Enforces guaranteed pre-compile flush across all in-memory dirty documents via DocumentSessionCoordinator.
 * - Gathers in-memory dirty buffers and active editor content for zero-latency incremental compilation.
 * - Manages PDF ObjectURL lifecycle (automatically revoking old ObjectURLs to prevent memory leaks).
 * - Stores parsed SyncTeX map and raw SyncTeX text for instant bidirectional navigation.
 * - Manages pending compile queue when edits occur mid-compilation.
 * - Dispatches typed progress events on IEditorCommandBus (compiler:started, compiler:progress, compiler:finished).
 * - Decouples presentation components (Viewer, Topbar, Editor) from network and cancellation logic.
 */

import { LatexCompilerEngine, type SyncTeXMap } from '../../utils/viewer.util';
import { latexDependencyGraph } from '../../utils/latex-dependency.util';
import { diagnosticsCoordinator } from './diagnostics.coordinator';
import { documentSessionCoordinator } from '../session/document-session-coordinator';
import { editorCommandBus } from '../command-bus/editor-command-bus';
import { useCompileStore, usePageStore, useSettingsStore } from '../../store';
import { getActiveEditorContent } from '../context/editor-instance.context';
import type { CompileError } from '../../types/compiler.types';

export interface CompileOptions {
  forceClean?: boolean;
  draft?: boolean;
  reason?: 'manual' | 'auto' | 'shortcut';
  onThumbnailGenerated?: (dataUrl: string) => void;
}

export interface SyncTeXForwardDetail {
  page: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface SyncTeXReverseDetail {
  sourcePath: string | null;
  line: number;
}

class CompilerLifecycleCoordinatorRegistry {
  private isCompiling = false;
  private prevPdfUrl: string | null = null;
  private synctexMap: SyncTeXMap | null = null;
  private rawSynctex: string | null = null;
  private initialized = false;

  constructor() {
    this.initCommandSubscriptions();
  }

  /**
   * Initializes global CommandBus listeners so compile and synctex can be triggered from anywhere.
   */
  private initCommandSubscriptions(): void {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    editorCommandBus.subscribe('compiler:trigger', (cmd) => {
      void this.compile({
        forceClean: cmd.forceSync,
        draft: cmd.draft,
        reason: 'shortcut',
      });
    });

    editorCommandBus.subscribe('synctex:forward', (cmd) => {
      if (cmd.line !== undefined) {
        const target = this.resolveForward(cmd.line);
        if (target !== null) {
          editorCommandBus.dispatch({ type: 'viewer:goto-page', page: target });
        }
      }
    });
  }

  /**
   * Returns whether a compilation is currently in flight.
   */
  public getIsCompiling(): boolean {
    return this.isCompiling;
  }

  /**
   * Retrieves the current SyncTeX map.
   */
  public getSynctexMap(): SyncTeXMap | null {
    return this.synctexMap;
  }

  /**
   * Sets or updates the current SyncTeX map.
   */
  public setSynctexMap(map: SyncTeXMap | null): void {
    this.synctexMap = map;
  }

  /**
   * Retrieves the raw SyncTeX string.
   */
  public getRawSynctex(): string | null {
    return this.rawSynctex;
  }

  /**
   * Main compilation execution coordinator.
   */
  public async compile(options?: CompileOptions): Promise<boolean> {
    const pageStore = usePageStore.getState();
    const settingsStore = useSettingsStore.getState();
    const compileStore = useCompileStore.getState();

    const currentPage = pageStore.currentPage;
    const activeFilePage = pageStore.activeFilePage;
    const rootPageId = (currentPage as any)?.id || pageStore.projectId || null;

    if (!rootPageId) {
      return false;
    }

    // 1. Guard against overlapping compilations: cancel previous in-flight job
    if (this.isCompiling) {
      LatexCompilerEngine.cancelInFlightCompile();
    }
    this.isCompiling = true;

    // 2. Guaranteed pre-compile flush: persist all dirty buffers in memory to disk
    await documentSessionCoordinator.flushAllPending();

    // 3. Notify start of compilation
    editorCommandBus.dispatch({ type: 'compiler:started' });
    compileStore.setCompileStatus('compiling');

    // 4. Collect dirty file buffers & active editor text
    const dirtyFiles = compileStore.getDirtyFiles();
    const currentVal = getActiveEditorContent();
    const effectiveActiveFileId = activeFilePage?.id || rootPageId;

    if (effectiveActiveFileId && currentVal) {
      const idx = dirtyFiles.findIndex((f) => f.fileId === effectiveActiveFileId);
      if (idx >= 0) {
        dirtyFiles[idx].content = currentVal;
      } else {
        dirtyFiles.push({ fileId: effectiveActiveFileId, content: currentVal });
      }
    }

    const effectiveProjectId =
      typeof currentPage?.projectId === 'object'
        ? (currentPage.projectId as any)?.id
        : currentPage?.projectId || pageStore.projectId || '';

    // 5. Update LaTeX Include Dependency Graph with latest buffers
    const activeTitle = activeFilePage?.title || (currentPage as any)?.title || 'main.tex';
    const activeContent = currentVal || (currentPage as any)?.content || '';
    if (effectiveActiveFileId) {
      latexDependencyGraph.updateFileNode(effectiveActiveFileId, activeTitle, activeContent);
    }
    for (const df of dirtyFiles) {
      if (df.fileId !== effectiveActiveFileId) {
        latexDependencyGraph.updateFileNode(df.fileId, df.fileId, df.content);
      }
    }

    // 6. Infer compile Root Document (DAG traversal, subfile resolution, or settings preference)
    const inferred = latexDependencyGraph.inferRootDocument(
      effectiveActiveFileId,
      settingsStore.mainFile
    );
    const resolvedMainFile = inferred.rootPath;

    diagnosticsCoordinator.registerAlias(effectiveActiveFileId, activeTitle);
    if (resolvedMainFile) {
      diagnosticsCoordinator.registerAlias(resolvedMainFile, resolvedMainFile);
    }

    if (inferred.hasCycleWarning) {
      console.warn('[CompilerLifecycleCoordinator] Circular include dependency detected in LaTeX project DAG');
    }

    // Determine entry source: only pass active content if active file matches the root document
    const isEditingRoot =
      inferred.inferredBy === 'active-standalone' ||
      effectiveActiveFileId === inferred.rootFileId ||
      activeTitle === resolvedMainFile ||
      activeTitle.endsWith(`/${resolvedMainFile}`);

    const sourcePayload = isEditingRoot
      ? activeContent
      : undefined;

    try {
      const res = await LatexCompilerEngine.compile({
        projectId: effectiveProjectId,
        pageId: effectiveActiveFileId,
        mainFile: resolvedMainFile,
        source: sourcePayload,
        engine: settingsStore.engine || 'pdflatex',
        texLiveVersion: settingsStore.texLiveVersion,
        draft: options?.draft ?? (settingsStore.compileMode === 'draft'),
        useCache: options?.forceClean ? false : settingsStore.useCache,
        forceClean: options?.forceClean,
        stopOnFirstError: settingsStore.stopOnFirstError,
        dirtyFiles,
        onPhaseChange: (phase) => {
          compileStore.setCompileStatus(phase);
          editorCommandBus.dispatch({ type: 'compiler:progress', status: phase });
        },
        onThumbnailGenerated: (base64) => {
          const dataUrl = `data:image/jpeg;base64,${base64}`;
          options?.onThumbnailGenerated?.(dataUrl);
        },
      });

      this.isCompiling = false;

      if (res.success) {
        // Revoke previous blob ObjectURL to prevent memory leaks
        if (
          this.prevPdfUrl &&
          this.prevPdfUrl.startsWith('blob:') &&
          this.prevPdfUrl !== res.pdfUrl
        ) {
          URL.revokeObjectURL(this.prevPdfUrl);
        }
        this.prevPdfUrl = res.pdfUrl;

        compileStore.setPdfUrl(res.pdfUrl);
        this.synctexMap = res.synctexMap ?? null;
        this.rawSynctex = res.rawSynctex ?? null;
        compileStore.setCompileLog(res.logs);
        compileStore.setCompileStatus('done');
        compileStore.setLastCompiledAt(res.compiledAt);

        // Keep all non-error diagnostics (warnings, badboxes, info notes) for Overleaf log parity
        const nonErrorDiagnostics: CompileError[] =
          res.diagnostics && res.diagnostics.length > 0
            ? res.diagnostics
                .filter((d) => d.severity !== 'error')
                .map((d) => ({
                  line: d.line,
                  message: d.message,
                  context: d.context || '',
                  file: d.file,
                  severity: d.severity,
                  code: d.code,
                  suggestion: d.suggestion,
                }))
            : [];
        compileStore.setCompileErrors(nonErrorDiagnostics);
        diagnosticsCoordinator.ingestCompilerErrors(nonErrorDiagnostics, resolvedMainFile);

        // Clear flushed dirty flags
        if (res.flushedFileIds && res.flushedFileIds.length > 0) {
          res.flushedFileIds.forEach((fid) => compileStore.clearDirty(fid));
        } else if (!res.flushErrors || res.flushErrors.length === 0) {
          compileStore.clearAllDirty();
        }

        editorCommandBus.dispatch({ type: 'compiler:finished', success: true });

        // If changes were made while compiling, schedule one immediate re-compile
        if (compileStore.pendingCompile) {
          compileStore.setPendingCompile(false);
          setTimeout(() => {
            void this.compile();
          }, 400);
        }

        return true;
      } else {
        if (res.error === 'Compilation superseded' || res.error === 'Compilation stopped') {
          compileStore.setCompileStatus('idle');
          editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
          return false;
        }

        compileStore.setCompileStatus('error');
        compileStore.setCompileLog(res.logs);

        const formattedErrors: CompileError[] =
          res.diagnostics && res.diagnostics.length > 0
            ? res.diagnostics.map((d) => ({
                line: d.line,
                message: d.message,
                context: d.context || '',
                file: d.file,
                severity: d.severity,
                code: d.code,
                suggestion: d.suggestion,
              }))
            : (res.errors || []).map((err) => ({
                line: err.line,
                message: err.message,
                context: err.context,
                file: err.file,
                severity: err.severity,
                code: err.code,
                suggestion: err.suggestion,
              }));

        compileStore.setCompileErrors(formattedErrors);
        diagnosticsCoordinator.ingestCompilerErrors(formattedErrors, resolvedMainFile);

        if (res.flushedFileIds && res.flushedFileIds.length > 0) {
          res.flushedFileIds.forEach((fid) => compileStore.clearDirty(fid));
        }

        editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: false });

        if (compileStore.pendingCompile) {
          compileStore.setPendingCompile(false);
          setTimeout(() => {
            void this.compile();
          }, 400);
        }

        return false;
      }
    } catch (err) {
      this.isCompiling = false;
      compileStore.setCompileStatus('error');
      editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: false });
      return false;
    }
  }

  /**
   * Forces an incremental re-synchronization of project files.
   */
  public async forceSync(projectId?: string): Promise<{ synced: string[] }> {
    const targetId = projectId || usePageStore.getState().projectId || '';
    if (!targetId) return { synced: [] };

    useCompileStore.getState().setCompileStatus('syncing');
    try {
      const res = await LatexCompilerEngine.forceSync(targetId);
      await this.compile();
      return res;
    } catch (err) {
      useCompileStore.getState().setCompileStatus('error');
      throw err;
    }
  }

  /**
   * Cancels in-flight compilation.
   */
  public stop(): void {
    LatexCompilerEngine.cancelInFlightCompile();
    this.isCompiling = false;
    useCompileStore.getState().setCompileStatus('idle');
  }

  /**
   * Resolves Forward SyncTeX (Editor line -> PDF Page and coordinates).
   */
  public resolveForwardDetail(
    line: number,
    activeTitle?: string,
    maxPages?: number
  ): SyncTeXForwardDetail | null {
    return LatexCompilerEngine.resolveForwardDetail(line, this.synctexMap, activeTitle, maxPages);
  }

  /**
   * Resolves Forward SyncTeX to target page number.
   */
  public resolveForward(
    line: number,
    activeTitle?: string,
    maxPages?: number
  ): number | null {
    return LatexCompilerEngine.resolveForward(line, this.synctexMap, activeTitle, maxPages);
  }

  /**
   * Resolves Reverse SyncTeX (PDF Click -> Source File & Line).
   */
  public resolveReverse(
    clickFraction: number,
    pageNum: number,
    ptX?: number,
    ptY?: number
  ): SyncTeXReverseDetail | null {
    return LatexCompilerEngine.resolveReverse(clickFraction, pageNum, this.synctexMap, ptX, ptY);
  }
}

export const compilerLifecycleCoordinator = new CompilerLifecycleCoordinatorRegistry();
