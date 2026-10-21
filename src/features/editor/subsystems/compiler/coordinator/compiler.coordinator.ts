/**
 * compiler.coordinator.ts
 *
 * Headless Compiler & SyncTeX Lifecycle Coordinator (Deep Module - Coordinators Layer).
 * Follows Matt Pocock's Codebase Design principles:
 * - Deep Module: High leverage behind a concise interface (compilation orchestration,
 *   pre-compile flush, DAG Root inference, PDF blob lifecycle, SyncTeX mapping, and diagnostics indexing).
 * - Real Seam: Injected CompilerExecutionPort with production & in-memory test stand-in support.
 * - Single source of truth for the active compilation lifecycle (IDLE -> COMPILING -> SYNCING -> SUCCESS / ERROR / ABORTED).
 */

import { LatexCompilerEngine, type CompilerExecutionEngine, type CompilerExecutionPort } from './compilation-pipeline';
import { CompilationFlushBarrier } from './compilation-flush-barrier';
import {
  resolveForwardDetail,
  resolveForward,
  resolveReverse,
  type SyncTeXMap,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import {
  assembleCompilationSnapshot,
  type ProjectCompilationSnapshot,
  type SnapshotProjectFile,
} from '@/features/editor/domain/document/compilation-snapshot';
import { latexDagEngine } from '@/features/editor/domain/latex/latex-dag-engine';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { diagnosticsCoordinator, type IndexedDiagnosticItem, type FileDiagnosticsSummary } from '@/features/editor/subsystems/diagnostics';
import {
  editorCommandBus,
  workspaceCoordinator,
  sessionCoordinator,
  usePageStore,
  useSettingsStore,
  useConnectivityStore,
  getActiveEditorContent,
  getActiveEditorEngine,
  getActivePdfViewer,
} from '@/features/editor/core';
import { useCompileStore } from './compiler.store';
import type { CompileError, CompileStatus } from '@/features/editor/domain/types/compiler.types';
import { extractProjectId, extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import type { NodeTreeItem } from '@/features/editor/domain/types/node.types';
import { parseCompileErrors } from '@/features/editor/domain/latex/latex-structure';

export interface CreateSnapshotOptions {
  rootFileId?: string;
  resolvedMainFile?: string;
  projectFiles?: SnapshotProjectFile[];
  activeContentOverride?: string;
}

/**
 * Collects fileId -> path/title from every page-store source (file hierarchy, current page,
 * active file page) so in-memory models registered without a filePath are not keyed by UUID.
 */
export function buildPageStoreFilePaths(pageStore: {
  fileHierarchy?: NodeTreeItem[] | null;
  currentPage?: { id?: string; title?: string; path?: string } | null;
  activeFilePage?: { id?: string; title?: string; path?: string } | null;
}): Record<string, string> {
  const map: Record<string, string> = {};
  const add = (id?: string, path?: string) => {
    if (id && path && path !== id && !map[id]) map[id] = path;
  };
  add(pageStore.activeFilePage?.id, pageStore.activeFilePage?.path || pageStore.activeFilePage?.title);
  add(pageStore.currentPage?.id, pageStore.currentPage?.path || pageStore.currentPage?.title);
  const stack: NodeTreeItem[] = [...(pageStore.fileHierarchy ?? [])];
  while (stack.length > 0) {
    const node = stack.pop()!;
    add(node.id, node.title);
    if (node.children?.length) stack.push(...node.children);
  }
  return map;
}

export class CompilationSnapshotProvider {
  public static createSnapshot(options: CreateSnapshotOptions = {}): ProjectCompilationSnapshot {
    const pageStore = usePageStore.getState();
    const compileStore = useCompileStore.getState();

    const activeDoc = pageStore.getActiveDocument();
    const activeContent = options.activeContentOverride || getActiveEditorContent() || extractDocumentContentString(activeDoc?.content);

    const baseFiles = options.projectFiles || workspaceCoordinator.getProjectFiles() || [];
    const lruModels = lruDocumentCache.getAllModels();
    const dirtyFiles = compileStore.getDirtyFiles();

    return assembleCompilationSnapshot({
      baseFiles,
      lruModels,
      dirtyFiles,
      currentPage: pageStore.currentPage,
      activeDoc,
      activeContent,
      rootFileId: options.rootFileId,
      resolvedMainFile: options.resolvedMainFile,
      filePathsById: buildPageStoreFilePaths(pageStore),
    });
  }
}

export interface CompileOptions {
  forceClean?: boolean;
  draft?: boolean;
  reason?: 'manual' | 'auto' | 'shortcut' | 'manual-button' | 'keyboard-shortcut' | 'auto-compile' | 'external-trigger';
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
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface CompilerCoordinatorOptions {
  compilerEngine?: CompilerExecutionEngine;
  getProjectId?: () => string | undefined;
  getMainFile?: () => string | undefined;
  getEngine?: () => string | undefined;
  getTexLiveVersion?: () => string | undefined;
}

export class CompilerCoordinatorRegistry {
  private isCompiling = false;
  private compileAbortController: AbortController | null = null;
  private pendingCompileOptions: CompileOptions | undefined = undefined;
  private synctexMap: SyncTeXMap | null = null;
  private rawSynctex: string | null = null;
  private initialized = false;

  /** Injected Compiler Engine (LatexCompilerEngine by default) */
  private compilerEngine: CompilerExecutionEngine;
  private readonly options: CompilerCoordinatorOptions;

  constructor(options: CompilerCoordinatorOptions = {}) {
    this.options = options;
    this.compilerEngine = options.compilerEngine || LatexCompilerEngine;
    this.initCommandSubscriptions();
  }

  /**
   * Deterministically drains any queued compilation right after the current compile
   * promise settles via queueMicrotask, avoiding arbitrary setTimeout delays.
   */
  private scheduleNextPendingCompile(completedController: AbortController): void {
    if (this.compileAbortController === completedController) {
      this.compileAbortController = null;
    }
    this.isCompiling = false;

    if (!useCompileStore.getState().pendingCompile) {
      return;
    }

    const nextOpts = this.pendingCompileOptions;
    this.pendingCompileOptions = undefined;
    useCompileStore.getState().setPendingCompile(false);

    queueMicrotask(() => {
      void this.compile(nextOpts);
    });
  }

  // ── Dependency Injection & Seam Configuration ───────────────────────────────

  public setCompilerEngine(engine: CompilerExecutionPort): void {
    this.compilerEngine = engine;
  }

  public getCompilerEngine(): CompilerExecutionPort {
    return this.compilerEngine;
  }

  private initCommandSubscriptions(): void {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    editorCommandBus.subscribe('compiler:trigger', (cmd) => {
      void this.compile({
        forceClean: cmd.forceClean ?? cmd.forceSync,
        draft: cmd.draft,
        reason: 'shortcut',
      });
    });

    editorCommandBus.subscribe('synctex:forward', (cmd) => {
      // If a full PDF preview surface is active, useViewerSyncTeX handles forward sync with coordinate precision
      if (getActivePdfViewer()) return;

      let targetLine = cmd.line;
      if (targetLine === undefined) {
        const engine = getActiveEditorEngine();
        targetLine = engine?.getCursorPosition?.()?.line ?? 1;
      }
      if (targetLine !== undefined) {
        const activeDoc = usePageStore.getState().getActiveDocument();
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
        const mappedStatus =
          cmd.status === 'failed'
            ? 'error'
            : cmd.status === 'success'
              ? 'done'
              : cmd.status === 'queued'
                ? 'compiling'
                : cmd.status;
        if (['idle', 'flushing', 'compiling', 'syncing', 'done', 'success', 'error', 'aborted'].includes(mappedStatus)) {
          useCompileStore.getState().setCompileStatus(mappedStatus as CompileStatus);
        }
      }
      if (cmd.logs && cmd.logs.length > 0) {
        useCompileStore.getState().setCompileLog(cmd.logs.join('\n'));
      }
    });

    editorCommandBus.subscribe('compiler:finished', (cmd) => {
      useCompileStore.getState().setCompileStatus(cmd.success || cmd.aborted ? 'idle' : 'error');
    });
  }

  public getIsCompiling(): boolean {
    return this.isCompiling || useCompileStore.getState().compileStatus === 'compiling';
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

  // ── Deep Diagnostics Exposure (High Leverage) ──────────────────────────────

  public getDiagnostics(fileIdOrPath?: string, applyFilter = true): IndexedDiagnosticItem[] {
    if (fileIdOrPath) {
      return diagnosticsCoordinator.getDiagnosticsForFile(fileIdOrPath, applyFilter);
    }
    return diagnosticsCoordinator.getAllDiagnostics(applyFilter);
  }

  public getDiagnosticsCount(severity?: 'error' | 'warning' | 'info', applyFilter = true): number {
    return diagnosticsCoordinator.getDiagnosticsCount(severity, applyFilter);
  }

  public getFileSummary(fileIdOrPath: string, applyFilter = true): FileDiagnosticsSummary {
    return diagnosticsCoordinator.getFileSummary(fileIdOrPath, applyFilter);
  }

  public async compile(options?: CompileOptions): Promise<boolean> {
    const pageStore = usePageStore.getState();
    const settingsStore = useSettingsStore.getState();
    const compileStore = useCompileStore.getState();

    const activeDoc = pageStore.getActiveDocument();
    const rootPageId = activeDoc?.id || pageStore.projectId || null;

    if (!rootPageId) {
      return false;
    }

    // 0. Guard against offline compilation: queue compile for reconnection and protect drafts
    const isOnline =
      useConnectivityStore.getState().isOnline &&
      (typeof navigator === 'undefined' || navigator.onLine);

    if (!isOnline) {
      useConnectivityStore.getState().setOfflinePendingCompile(true);
      sessionCoordinator.flushPendingDrafts();
      compileStore.setCompileStatus('idle');
      compileStore.setCompileLog(
        '[Offline Mode] You are currently offline. Changes are safely saved locally (IndexedDB).\n' +
        'Compilation has been queued and will start automatically when connection is restored.'
      );
      editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
      return false;
    }

    // 1. Guard against overlapping compilations: cancel previous in-flight job and queue next
    if (this.isCompiling || compileStore.compileStatus === 'compiling') {
      compileStore.setPendingCompile(true);
      this.pendingCompileOptions = {
        ...this.pendingCompileOptions,
        ...options,
        forceClean: options?.forceClean || this.pendingCompileOptions?.forceClean,
      };
      this.compileAbortController?.abort();
      const cancelProjectId =
        (this.options.getProjectId ? this.options.getProjectId() : undefined) ||
        extractProjectId(activeDoc) ||
        pageStore.projectId ||
        undefined;
      this.compilerEngine.cancelInFlightCompile(cancelProjectId);
      return false;
    }
    this.isCompiling = true;
    const currentController = new AbortController();
    this.compileAbortController = currentController;
    const effectiveActiveFileId = activeDoc?.id || rootPageId;
    const activeTitle = pageStore.getActiveDocumentTitle();
    const currentVal = getActiveEditorContent() || extractDocumentContentString(activeDoc?.content);

    // 2. Pre-compile atomic flush barrier: commit drafts, sync active buffer, trigger background save
    await CompilationFlushBarrier.execute(effectiveActiveFileId, currentVal);

    // 3. Notify start of compilation
    editorCommandBus.dispatch({ type: 'compiler:started' });
    compileStore.setCompileStatus('compiling');

    // 4. Update LaTeX DAG with all active in-memory buffers
    const allModels = lruDocumentCache.getAllModels();
    for (const m of allModels) {
      latexDagEngine.updateFileNode(m.fileId, m.filePath || m.fileId, m.content);
    }
    if (activeDoc && activeDoc.content) {
      const cTitle = activeDoc.title || 'main.tex';
      const cContent = extractDocumentContentString(activeDoc.content);
      latexDagEngine.updateFileNode(activeDoc.id, cTitle, cContent);
    }
    if (effectiveActiveFileId) {
      latexDagEngine.updateFileNode(effectiveActiveFileId, activeTitle, currentVal);
    }

    // 5. Infer Root Document (DAG traversal, subfile resolution, or settings preference)
    const preferredMainFile = this.options.getMainFile
      ? this.options.getMainFile()
      : settingsStore.mainFile;

    const inferred = latexDagEngine.inferRootDocument(
      effectiveActiveFileId,
      preferredMainFile
    );
    const resolvedMainFile = inferred.rootPath;

    // Register aliases: canonicalPath is the clean path, alias is the file ID / alternate key
    if (activeTitle && effectiveActiveFileId) {
      diagnosticsCoordinator.registerAlias(activeTitle, effectiveActiveFileId);
    }
    if (resolvedMainFile) {
      diagnosticsCoordinator.registerAlias(resolvedMainFile, resolvedMainFile);
    }
    if (resolvedMainFile && inferred.rootFileId) {
      diagnosticsCoordinator.registerAlias(resolvedMainFile, inferred.rootFileId);
    }
    const allFilePathsById = buildPageStoreFilePaths(pageStore);
    for (const [fId, fPath] of Object.entries(allFilePathsById)) {
      if (fId && fPath) {
        diagnosticsCoordinator.registerAlias(fPath, fId);
      }
    }
    const wsFiles = workspaceCoordinator.getProjectFiles() || [];
    for (const wf of wsFiles) {
      const wfPath = wf.path || wf.title;
      if (wf.id && wfPath) {
        diagnosticsCoordinator.registerAlias(wfPath, wf.id);
      }
    }

    if (inferred.hasCycleWarning) {
      console.warn('[CompilerCoordinator] Circular include dependency detected in LaTeX project DAG');
    }

    const effectiveProjectId =
      (this.options.getProjectId ? this.options.getProjectId() : undefined) ||
      extractProjectId(activeDoc) ||
      pageStore.projectId ||
      '';

    // 6. Create an atomic in-memory snapshot across open tabs & editor buffer (0ms latency)
    // Guard: never use .bib file ID as the rootFileId for LaTeX compiler
    const isBibFile = activeTitle.toLowerCase().endsWith('.bib');
    const safeRootFileId =
      inferred.rootFileId ||
      (!isBibFile ? activeDoc?.id : undefined) ||
      pageStore.projectId;

    const snapshot = CompilationSnapshotProvider.createSnapshot({
      rootFileId: safeRootFileId,
      resolvedMainFile,
    });

    try {
      const res = await this.compilerEngine.compile({
        projectId: effectiveProjectId,
        pageId: effectiveActiveFileId,
        mainFile: resolvedMainFile,
        source: snapshot.source,
        files: snapshot.files,
        engine: this.options.getEngine?.() || settingsStore.engine || 'pdflatex',
        texLiveVersion: this.options.getTexLiveVersion?.() || settingsStore.texLiveVersion,
        draft: options?.draft ?? (settingsStore.compileMode === 'draft'),
        useCache: options?.forceClean ? false : settingsStore.useCache,
        forceClean: options?.forceClean,
        stopOnFirstError: settingsStore.stopOnFirstError,
        dirtyFiles: snapshot.dirtyFileIds.map((id: string) => ({ fileId: id, content: snapshot.files[id] || '' })),
        onPhaseChange: (phase: string) => {
          compileStore.setCompileStatus(phase as CompileStatus);
          editorCommandBus.dispatch({ type: 'compiler:progress', status: phase });
        },
        onThumbnailGenerated: (base64: string) => {
          const dataUrl = `data:image/jpeg;base64,${base64}`;
          options?.onThumbnailGenerated?.(dataUrl);
        },
      });

      if (res.success) {
        compileStore.setPdfUrl(res.pdfUrl ?? null);
        this.synctexMap = res.synctexMap ?? null;
        this.rawSynctex = res.rawSynctex ?? res.synctexData ?? null;
        compileStore.setCompileLog(res.logs ?? res.rawLog ?? null);
        compileStore.setCompileStatus('done');
        compileStore.setLastCompiledAt(
          res.compiledAt instanceof Date
            ? res.compiledAt
            : typeof res.compiledAt === 'number'
              ? new Date(res.compiledAt)
              : new Date(),
        );

        // Asynchronously update synctexMap when non-blocking parser resolves
        if (res.synctexPromise) {
          res.synctexPromise.then((map: SyncTeXMap | null) => {
            if (map) {
              this.synctexMap = map;
              editorCommandBus.dispatch({ type: 'synctex:map-updated', map });
            }
          });
        }

        const sanitizeDash = (s?: string) => (s ? s.replace(/[\u2014\u2013]/g, '-') : '');
        const rawLog = res.logs ?? res.rawLog ?? '';
        const rawSuccessDiagnostics =
          res.diagnostics && res.diagnostics.length > 0
            ? res.diagnostics
            : rawLog
              ? parseCompileErrors(rawLog)
              : [];
        // Only ingest real errors and warnings into Editor Diagnostics Coordinator.
        // Filter out badboxes and info messages (Overfull \hbox etc.) so they stay in CompilerLogs panel only.
        const successDiagnostics: CompileError[] = rawSuccessDiagnostics
          .filter((d) => d.severity !== 'info' && !/^(Overfull|Underfull)\s*\\[hv]box/i.test(d.message || ''))
          .map((d) => ({
            line: d.line,
            message: sanitizeDash(d.message),
            context: sanitizeDash(d.context || ''),
            file: d.file,
            severity: d.severity,
            code: d.code,
            suggestion: d.suggestion,
          }));
        compileStore.setCompileErrors(successDiagnostics);
        diagnosticsCoordinator.ingestCompilerErrors(successDiagnostics, resolvedMainFile);

        if (res.flushedFileIds && res.flushedFileIds.length > 0) {
          res.flushedFileIds.forEach((fid: string) => compileStore.clearDirty(fid));
        } else if (!res.flushErrors || res.flushErrors.length === 0) {
          compileStore.clearAllDirty();
        }

        editorCommandBus.dispatch({ type: 'compiler:finished', success: true });
        this.scheduleNextPendingCompile(currentController);

        return true;
      } else {
        const rawLog = res.logs ?? res.rawLog ?? '';
        const isAborted =
          res.aborted ||
          res.status === 'aborted' ||
          currentController.signal.aborted ||
          res.error === 'Compilation superseded' ||
          res.error === 'Compilation stopped' ||
          res.error?.toLowerCase().includes('aborted') ||
          rawLog.toLowerCase().includes('signal is aborted');

        if (isAborted) {
          compileStore.setCompileStatus('idle');
          editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
          this.scheduleNextPendingCompile(currentController);
          return false;
        }

        compileStore.setCompileStatus('error');
        compileStore.setCompileLog(rawLog || null);

        const sanitizeDash = (s?: string) => (s ? s.replace(/[\u2014\u2013]/g, '-') : '');

        const formattedErrors: CompileError[] =
          res.diagnostics && res.diagnostics.length > 0
            ? res.diagnostics
                .filter((d) => d.severity !== 'info' && !/^(Overfull|Underfull)\s*\\[hv]box/i.test(d.message || ''))
                .map((d) => ({
                  line: d.line,
                  message: sanitizeDash(d.message),
                  context: sanitizeDash(d.context || ''),
                  file: d.file,
                  severity: d.severity,
                  code: d.code,
                  suggestion: d.suggestion,
                }))
            : (res.errors || [])
                .filter((err) => err.severity !== 'info' && !/^(Overfull|Underfull)\s*\\[hv]box/i.test(err.message || ''))
                .map((err) => ({
                  line: err.line,
                  message: sanitizeDash(err.message),
                  context: sanitizeDash(err.context),
                  file: err.file,
                  severity: err.severity,
                  code: err.code,
                  suggestion: err.suggestion,
                }));

        compileStore.setCompileErrors(formattedErrors);
        diagnosticsCoordinator.ingestCompilerErrors(formattedErrors, resolvedMainFile);

        if (res.flushedFileIds && res.flushedFileIds.length > 0) {
          res.flushedFileIds.forEach((fid: string) => compileStore.clearDirty(fid));
        }

        editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: false });
        this.scheduleNextPendingCompile(currentController);

        return false;
      }
    } catch (err) {
      const isNetworkError =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        (err instanceof Error && /network|fetch|failed to fetch|offline/i.test(err.message));

      if (isNetworkError) {
        useConnectivityStore.getState().recordOffline();
        useConnectivityStore.getState().setOfflinePendingCompile(true);
        sessionCoordinator.flushPendingDrafts();
        compileStore.setCompileStatus('idle');
        compileStore.setCompileLog(
          '[Offline Mode] Network connection lost during compilation request.\n' +
          'Your draft is saved locally and will automatically recompile when reconnected.'
        );
        editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
      } else {
        compileStore.setCompileStatus('error');
        editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: false });
        this.scheduleNextPendingCompile(currentController);
      }
      return false;
    } finally {
      if (this.compileAbortController === currentController) {
        this.compileAbortController = null;
      }
      this.isCompiling = false;
      if (useCompileStore.getState().compileStatus === 'compiling') {
        useCompileStore.getState().setCompileStatus('idle');
      }
    }
  }

  public async forceSync(projectId?: string): Promise<{ synced: string[] }> {
    const targetId =
      projectId ||
      (this.options.getProjectId ? this.options.getProjectId() : undefined) ||
      usePageStore.getState().projectId ||
      '';
    if (!targetId) return { synced: [] };

    useCompileStore.getState().setCompileStatus('syncing');
    try {
      const res = this.compilerEngine.forceSync
        ? await this.compilerEngine.forceSync(targetId)
        : await LatexCompilerEngine.forceSync(targetId);
      await this.compile();
      return res;
    } catch (err) {
      useCompileStore.getState().setCompileStatus('error');
      throw err;
    }
  }

  public stop(): void {
    const pageStore = usePageStore.getState();
    const activeDoc = pageStore.getActiveDocument();
    const targetProjectId =
      (this.options.getProjectId ? this.options.getProjectId() : undefined) ||
      extractProjectId(activeDoc) ||
      pageStore.projectId ||
      undefined;
    this.pendingCompileOptions = undefined;
    useCompileStore.getState().setPendingCompile(false);
    this.compileAbortController?.abort();
    this.compileAbortController = null;
    this.compilerEngine.cancelInFlightCompile(targetProjectId);
    this.isCompiling = false;
    useCompileStore.getState().setCompileStatus('idle');
  }

  public resolveForwardDetail(
    line: number,
    activeTitle?: string,
    maxPages?: number,
    synctexMapOverride?: SyncTeXMap | null,
  ): SyncTeXForwardDetail | null {
    const map = synctexMapOverride !== undefined ? synctexMapOverride : this.synctexMap;
    return resolveForwardDetail(line, map, activeTitle, maxPages);
  }

  public resolveForward(
    line: number,
    activeTitle?: string,
    maxPages?: number,
    synctexMapOverride?: SyncTeXMap | null,
  ): number | null {
    const map = synctexMapOverride !== undefined ? synctexMapOverride : this.synctexMap;
    return resolveForward(line, map, activeTitle, maxPages);
  }

  public resolveReverse(
    clickFraction: number,
    pageNum: number,
    ptX?: number,
    ptY?: number,
    synctexMapOverride?: SyncTeXMap | null,
    pageHeightPt?: number,
  ): SyncTeXReverseDetail | null {
    const map = synctexMapOverride !== undefined ? synctexMapOverride : this.synctexMap;
    return resolveReverse(clickFraction, pageNum, map, ptX, ptY, pageHeightPt);
  }

  public async resolveReverseRemote(
    projectId: string,
    pageNum: number,
    x: number,
    y: number,
  ): Promise<{ sourcePath: string | null; line: number } | null> {
    if (this.compilerEngine.resolveReverseRemote) {
      return this.compilerEngine.resolveReverseRemote(projectId, pageNum, x, y);
    }
    return LatexCompilerEngine.resolveReverseRemote(projectId, pageNum, x, y);
  }

  public async resolveForwardRemote(
    projectId: string,
    file: string,
    line: number,
    column: number = 0,
  ) {
    if (this.compilerEngine.resolveForwardRemote) {
      return this.compilerEngine.resolveForwardRemote(projectId, file, line, column);
    }
    return LatexCompilerEngine.resolveForwardRemote(projectId, file, line, column);
  }

  /**
   * Releases compiler resources and clears SyncTeX caches for GC.
   */
  public dispose(): void {
    this.stop();
    this.synctexMap = null;
    this.rawSynctex = null;
    this.pendingCompileOptions = undefined;
  }
}

export const compilerCoordinator = new CompilerCoordinatorRegistry();
