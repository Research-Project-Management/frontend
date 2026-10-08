/**
 * compiler.coordinator.ts
 *
 * Headless Compiler & SyncTeX Lifecycle Coordinator (Coordinators Layer).
 *
 * Responsibilities:
 * - Single source of truth for the active compilation lifecycle (IDLE -> COMPILING -> SYNCING -> SUCCESS / ERROR / ABORTED).
 * - Cancels in-flight compile jobs when a new compile is triggered (via AbortController).
 * - Enforces guaranteed pre-compile flush across all in-memory dirty documents via sessionCoordinator.
 * - Utilizes latexDagEngine to infer compile Root Document from any child file and detect circular includes.
 * - Manages PDF ObjectURL lifecycle (automatically revoking old ObjectURLs to prevent memory leaks).
 * - Stores parsed SyncTeX map and raw SyncTeX text for instant bidirectional navigation.
 * - Feeds diagnostics into diagnosticsCoordinator for file-partitioned O(log K) querying.
 * - Manages pending compile queue when edits occur mid-compilation.
 * - Dispatches typed progress events on IEditorCommandBus (compiler:started, compiler:progress, compiler:finished).
 */

import { LatexCompilerEngine, type SyncTeXMap } from '../domain/utils/viewer.util';
import { latexDagEngine } from '../domain/latex-dag-engine';
import { lruDocumentCache } from '../domain/lru-document-cache';
import { CompilationSnapshotProvider } from '../domain/compilation-snapshot';
import { diagnosticsCoordinator } from './diagnostics.coordinator';
import { sessionCoordinator } from './session.coordinator';
import { editorCommandBus } from './command-bus';
import { useCompileStore, usePageStore, useSettingsStore } from '../store';
import { getActiveEditorContent, getActiveEditorEngine } from './command-bus';
import type { CompileError } from '../domain/types/compiler.types';

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

export class CompilerCoordinatorRegistry {
  private isCompiling = false;
  private prevPdfUrl: string | null = null;
  private synctexMap: SyncTeXMap | null = null;
  private rawSynctex: string | null = null;
  private initialized = false;

  constructor() {
    this.initCommandSubscriptions();
  }

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
      let targetLine = cmd.line;
      if (targetLine === undefined) {
        const engine = getActiveEditorEngine();
        targetLine = engine?.getCursorPosition?.()?.line ?? 1;
      }
      if (targetLine !== undefined) {
        const activeDoc = usePageStore.getState().activeFilePage || usePageStore.getState().currentPage;
        const activeTitle = activeDoc?.title;
        const target = this.resolveForward(targetLine, activeTitle);
        if (target !== null) {
          editorCommandBus.dispatch({ type: 'viewer:goto-page', page: target });
        }
      }
    });

    editorCommandBus.subscribe('compiler:started', () => {
      useCompileStore.getState().setCompileStatus('compiling');
    });

    editorCommandBus.subscribe('compiler:progress', (cmd) => {
      if (cmd.status) {
        useCompileStore.getState().setCompileStatus(cmd.status as any);
      }
      if (cmd.logs && cmd.logs.length > 0) {
        useCompileStore.getState().setCompileLog(cmd.logs.join('\n'));
      }
    });

    editorCommandBus.subscribe('compiler:finished', (cmd) => {
      useCompileStore.getState().setCompileStatus(cmd.success ? 'idle' : 'error');
    });
  }

  public getIsCompiling(): boolean {
    return this.isCompiling;
  }

  public getSynctexMap(): SyncTeXMap | null {
    return this.synctexMap;
  }

  public setSynctexMap(map: SyncTeXMap | null): void {
    this.synctexMap = map;
  }

  public getRawSynctex(): string | null {
    return this.rawSynctex;
  }

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

    // 2. Non-blocking background auto-save (fires asynchronously in background, never delays compilation)
    void sessionCoordinator.flushAllPending().catch(() => {});

    // 3. Notify start of compilation
    editorCommandBus.dispatch({ type: 'compiler:started' });
    compileStore.setCompileStatus('compiling');

    const effectiveActiveFileId = activeFilePage?.id || rootPageId;
    const activeTitle = activeFilePage?.title || (currentPage as any)?.title || 'main.tex';
    const currentVal = getActiveEditorContent() || (currentPage as any)?.content || '';

    // 4. Update LaTeX DAG with all active in-memory buffers
    const allModels = lruDocumentCache.getAllModels();
    for (const m of allModels) {
      latexDagEngine.updateFileNode(m.fileId, m.filePath || m.fileId, m.content);
    }
    if (currentPage && (currentPage as any).content) {
      const cTitle = (currentPage as any).title || 'main.tex';
      const cContent =
        typeof (currentPage as any).content === 'string'
          ? (currentPage as any).content
          : (currentPage as any).content?.source || '';
      latexDagEngine.updateFileNode((currentPage as any).id, cTitle, cContent);
    }
    if (effectiveActiveFileId) {
      latexDagEngine.updateFileNode(effectiveActiveFileId, activeTitle, currentVal);
    }

    // 5. Infer Root Document (DAG traversal, subfile resolution, or settings preference)
    const inferred = latexDagEngine.inferRootDocument(
      effectiveActiveFileId,
      settingsStore.mainFile
    );
    const resolvedMainFile = inferred.rootPath;

    diagnosticsCoordinator.registerAlias(effectiveActiveFileId, activeTitle);
    if (resolvedMainFile) {
      diagnosticsCoordinator.registerAlias(resolvedMainFile, resolvedMainFile);
    }
    if (inferred.rootFileId) {
      diagnosticsCoordinator.registerAlias(inferred.rootFileId, resolvedMainFile);
    }

    if (inferred.hasCycleWarning) {
      console.warn('[CompilerCoordinator] Circular include dependency detected in LaTeX project DAG');
    }

    const effectiveProjectId =
      typeof currentPage?.projectId === 'object'
        ? (currentPage.projectId as any)?.id
        : currentPage?.projectId || pageStore.projectId || '';

    // 6. Create an atomic in-memory snapshot across open tabs & editor buffer (0ms latency)
    const snapshot = CompilationSnapshotProvider.createSnapshot({
      rootFileId: inferred.rootFileId || (currentPage as any)?.id || pageStore.projectId,
      resolvedMainFile,
    });

    try {
      const res = await LatexCompilerEngine.compile({
        projectId: effectiveProjectId,
        pageId: effectiveActiveFileId,
        mainFile: resolvedMainFile,
        source: snapshot.source,
        files: snapshot.files,
        engine: settingsStore.engine || 'pdflatex',
        texLiveVersion: settingsStore.texLiveVersion,
        draft: options?.draft ?? (settingsStore.compileMode === 'draft'),
        useCache: options?.forceClean ? false : settingsStore.useCache,
        forceClean: options?.forceClean,
        stopOnFirstError: settingsStore.stopOnFirstError,
        dirtyFiles: snapshot.dirtyFileIds.map((id) => ({ fileId: id, content: snapshot.files[id] || '' })),
        onPhaseChange: (phase) => {
          compileStore.setCompileStatus(phase);
          editorCommandBus.dispatch({ type: 'compiler:progress', status: phase });
        },
        onThumbnailGenerated: (base64) => {
          const dataUrl = `data:image/jpeg;base64,${base64}`;
          options?.onThumbnailGenerated?.(dataUrl);
        },
      });

      if (res.success) {
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

        if (res.flushedFileIds && res.flushedFileIds.length > 0) {
          res.flushedFileIds.forEach((fid) => compileStore.clearDirty(fid));
        } else if (!res.flushErrors || res.flushErrors.length === 0) {
          compileStore.clearAllDirty();
        }

        editorCommandBus.dispatch({ type: 'compiler:finished', success: true });

        if (compileStore.pendingCompile) {
          compileStore.setPendingCompile(false);
          setTimeout(() => {
            void this.compile();
          }, 200);
        }

        return true;
      } else {
        if (res.error === 'Compilation superseded' || res.error === 'Compilation stopped') {
          compileStore.setCompileStatus('idle');
          editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
          if (compileStore.pendingCompile) {
            compileStore.setPendingCompile(false);
            setTimeout(() => {
              void this.compile();
            }, 100);
          }
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
          }, 300);
        }

        return false;
      }
    } catch (err) {
      compileStore.setCompileStatus('error');
      editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: false });
      return false;
    } finally {
      this.isCompiling = false;
    }
  }

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

  public stop(): void {
    LatexCompilerEngine.cancelInFlightCompile();
    this.isCompiling = false;
    useCompileStore.getState().setCompileStatus('idle');
  }

  public resolveForwardDetail(
    line: number,
    activeTitle?: string,
    maxPages?: number
  ): SyncTeXForwardDetail | null {
    return LatexCompilerEngine.resolveForwardDetail(line, this.synctexMap, activeTitle, maxPages);
  }

  public resolveForward(
    line: number,
    activeTitle?: string,
    maxPages?: number
  ): number | null {
    return LatexCompilerEngine.resolveForward(line, this.synctexMap, activeTitle, maxPages);
  }

  public resolveReverse(
    clickFraction: number,
    pageNum: number,
    ptX?: number,
    ptY?: number
  ): SyncTeXReverseDetail | null {
    return LatexCompilerEngine.resolveReverse(clickFraction, pageNum, this.synctexMap, ptX, ptY);
  }
}

export const compilerCoordinator = new CompilerCoordinatorRegistry();
// Backward compatibility alias
export const compilerLifecycleCoordinator = compilerCoordinator;
