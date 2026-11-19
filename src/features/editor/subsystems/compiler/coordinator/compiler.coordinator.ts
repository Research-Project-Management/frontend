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

import { CompilePipeline, type CompilerPort } from './compile-pipeline';
import { FlushBarrier } from './flush-barrier';
import {
  resolveForwardDetail,
  resolveForward,
  resolveReverse,
  type SyncTeXMap,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  diagnosticsCoordinator,
  type IndexedDiagnosticItem,
  type FileDiagnosticsSummary,
} from '@/features/editor/subsystems/diagnostics/coordinator/diagnostics.coordinator';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import {
  getActiveEditorContent,
  getActiveEditorEngine,
  getActivePdfViewer,
  getAllRegisteredEngines,
  getEditorEngineForFile,
} from '@/features/editor/core/bus/engine-registry';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import {
  isNetworkError,
  useConnectivityStore,
} from '@/features/editor/core/store/connectivity.store';
import { useCompileStore } from './compiler.store';
import { multiTabBus } from '@/shared/lib/multi-tab';
import type { CompileStatus } from '@/features/editor/domain/types/compiler.types';
import {
  extractDocumentContentString,
  extractProjectId,
} from '@/features/editor/domain/types/core.types';
import { parseCompileErrors } from '@/features/editor/domain/latex/latex-structure';
import {
  diagnosticsToParsedLog,
  cacheBackendParsedLog,
} from '@/features/editor/domain/latex/compiler-logs-parser';
import {
  SnapshotProvider,
  buildPageStoreFilePaths,
  normalizeEditorDiagnostics,
  updateDagNodesAndAliases,
  buildCompileDirtyFilesPayload,
  type CreateSnapshotOptions,
} from './compilation-snapshot.provider';

export { SnapshotProvider, buildPageStoreFilePaths, type CreateSnapshotOptions };

const VALID_COMPILE_STATUSES = new Set<CompileStatus>([
  'idle',
  'flushing',
  'compiling',
  'syncing',
  'done',
  'success',
  'error',
  'aborted',
]);

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
  compilerEngine?: CompilerPort;
  getProjectId?: () => string | undefined;
  getMainFile?: () => string | undefined;
  getEngine?: () => string | undefined;
  getTexLiveVersion?: () => string | undefined;
}

export class CompilerCoordinator {
  private isCompiling = false;
  private compileAbortController: AbortController | null = null;
  private pendingCompileOptions: CompileOptions | undefined = undefined;
  private synctexMap: SyncTeXMap | null = null;
  private rawSynctex: string | null = null;
  private initialized = false;

  /** Injected Compiler Engine (CompilePipeline by default) */
  private compilerEngine: CompilerPort;
  private readonly options: CompilerCoordinatorOptions;

  constructor(options: CompilerCoordinatorOptions = {}) {
    this.options = options;
    this.compilerEngine = options.compilerEngine || CompilePipeline;
    this.initCommandSubscriptions();
  }

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

  public setCompilerEngine(engine: CompilerPort): void {
    this.compilerEngine = engine;
  }

  public getCompilerEngine(): CompilerPort {
    return this.compilerEngine;
  }

  private initCommandSubscriptions(): void {
    if ((typeof window === 'undefined' && process.env?.NODE_ENV !== 'test') || this.initialized) return;
    this.initialized = true;

    editorCommandBus.subscribe('compiler:trigger', (cmd) => {
      void this.compile({
        forceClean: cmd.forceClean ?? cmd.forceSync,
        draft: cmd.draft,
        reason: 'shortcut',
      });
    });

    editorCommandBus.subscribe('synctex:forward', (cmd) => {
      if (getActivePdfViewer()) return;

      let targetLine = cmd.line;
      if (targetLine === undefined) {
        const engine = getActiveEditorEngine();
        targetLine = engine?.getCursorPosition?.()?.line ?? 1;
      }
      if (targetLine !== undefined) {
        const activeDoc = usePageStore.getState().getActiveDocument();
        const target = this.resolveForward(targetLine, activeDoc?.title);
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
        if (VALID_COMPILE_STATUSES.has(mappedStatus as CompileStatus)) {
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

    multiTabBus.subscribe((msg) => {
      if (msg.type === 'EDITOR_COMPILATION_COMPLETED') {
        const pageStore = usePageStore.getState();
        const activeProjectId =
          pageStore.projectId ||
          pageStore.spaceId ||
          extractProjectId(pageStore.getActiveDocument());
        if (activeProjectId && activeProjectId === msg.projectId) {
          if (!this.isCompiling && msg.status === 'success' && msg.pdfUrl) {
            const compileStore = useCompileStore.getState();
            compileStore.setPdfUrl(msg.pdfUrl);
            compileStore.setCompileStatus('done');
            compileStore.setLastCompiledAt(new Date(msg.timestamp));
          }
        }
      }
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
    const rootPageId =
      pageStore.parentPageId ||
      pageStore.currentPage?.id ||
      pageStore.projectId ||
      activeDoc?.id ||
      null;

    if (!rootPageId) {
      return false;
    }

    const isOnline = useConnectivityStore.getState().checkIsOnline();
    if (!isOnline) {
      useConnectivityStore.getState().setOfflinePendingCompile(true);
      sessionCoordinator.flushPendingUnsyncedEdits();
      compileStore.setCompileStatus('idle');
      compileStore.setCompileLog(
        '[Offline Mode] You are currently offline. Changes are safely saved locally (IndexedDB).\n' +
        'Compilation has been queued and will start automatically when connection is restored.',
      );
      editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
      return false;
    }

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
        pageStore.spaceId ||
        undefined;
      this.compilerEngine.cancelInFlightCompile(cancelProjectId);
      return false;
    }

    this.isCompiling = true;
    const currentController = new AbortController();
    this.compileAbortController = currentController;
    const effectiveActiveFileId = activeDoc?.id || rootPageId;
    const activeTitle = pageStore.getActiveDocumentTitle();
    const activeEngine = effectiveActiveFileId ? getEditorEngineForFile?.(effectiveActiveFileId) : null;
    const registeredCount = getAllRegisteredEngines?.()?.size ?? 0;
    const fallbackActiveContent =
      registeredCount === 0 && effectiveActiveFileId === activeDoc?.id ? getActiveEditorContent() : null;
    const currentVal =
      activeEngine?.getContent?.() ||
      fallbackActiveContent ||
      (effectiveActiveFileId ? lruDocumentCache.getContent(effectiveActiveFileId) : undefined) ||
      extractDocumentContentString(activeDoc?.content);

    await FlushBarrier.execute(effectiveActiveFileId, currentVal);

    if (currentController.signal.aborted) {
      compileStore.setCompileStatus('idle');
      editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
      this.scheduleNextPendingCompile(currentController);
      return false;
    }

    editorCommandBus.dispatch({ type: 'compiler:started' });
    compileStore.setCompileStatus('compiling');

    const preferredMainFile = this.options.getMainFile
      ? this.options.getMainFile()
      : settingsStore.mainFile;

    const { allFilePathsById, resolvedMainFile, rootFileId, hasCycleWarning } =
      updateDagNodesAndAliases({
        pageStore,
        effectiveActiveFileId,
        activeDoc,
        activeTitle,
        currentVal,
        preferredMainFile,
      });

    if (hasCycleWarning) {
      console.warn('[CompilerCoordinator] Circular include dependency detected in LaTeX project DAG');
    }

    const effectiveProjectId =
      (this.options.getProjectId ? this.options.getProjectId() : undefined) ||
      extractProjectId(activeDoc) ||
      pageStore.projectId ||
      pageStore.spaceId ||
      '';

    const isBibFile = activeTitle.toLowerCase().endsWith('.bib');
    const safeRootFileId =
      rootFileId ||
      pageStore.parentPageId ||
      pageStore.currentPage?.id ||
      (!isBibFile ? activeDoc?.id : undefined) ||
      pageStore.projectId;

    const snapshot = SnapshotProvider.createSnapshot({
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
        dirtyFiles: buildCompileDirtyFilesPayload(
          snapshot.dirtyFileIds,
          allFilePathsById,
          snapshot.files,
          compileStore.dirtyContentMap,
        ),
        signal: currentController.signal,
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

        if (res.synctexPromise) {
          res.synctexPromise
            .then((map: SyncTeXMap | null) => {
              if (map && !currentController.signal.aborted) {
                this.synctexMap = map;
                editorCommandBus.dispatch({ type: 'synctex:map-updated', map });
              }
            })
            .catch(() => {});
        }

        const rawLog = res.logs ?? res.rawLog ?? '';
        const backendDiags = res.diagnostics || [];
        compileStore.setCompileDiagnostics(backendDiags);
        const structuredParsedLog = diagnosticsToParsedLog(backendDiags);
        if (rawLog) {
          cacheBackendParsedLog(rawLog, structuredParsedLog);
        }
        compileStore.setParsedLog(structuredParsedLog);

        const rawSuccessDiagnostics =
          backendDiags.length > 0
            ? backendDiags
            : rawLog
              ? parseCompileErrors(rawLog)
              : [];
        const successDiagnostics = normalizeEditorDiagnostics(rawSuccessDiagnostics, false);
        compileStore.setCompileErrors(successDiagnostics);
        diagnosticsCoordinator.ingestCompilerErrors(successDiagnostics, resolvedMainFile);

        if (res.flushedFileIds && res.flushedFileIds.length > 0) {
          res.flushedFileIds.forEach((fid: string) => {
            if (!lruDocumentCache.isDirty(fid)) {
              compileStore.clearDirty(fid);
            }
          });
        } else if (!res.flushErrors || res.flushErrors.length === 0) {
          for (const fid of Array.from(compileStore.dirtyFileIds)) {
            if (!lruDocumentCache.isDirty(fid)) {
              compileStore.clearDirty(fid);
            }
          }
        }

        editorCommandBus.dispatch({ type: 'compiler:finished', success: true });
        const activeProjectId =
          effectiveProjectId ||
          usePageStore.getState().spaceId ||
          usePageStore.getState().projectId ||
          extractProjectId(usePageStore.getState().getActiveDocument());
        if (activeProjectId) {
          multiTabBus.broadcast({
            type: 'EDITOR_COMPILATION_COMPLETED',
            projectId: activeProjectId,
            pdfUrl: res.pdfUrl ?? null,
            status: 'success',
            timestamp: Date.now(),
          });
        }
        this.scheduleNextPendingCompile(currentController);
        return true;
      }

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

      const backendDiags = res.diagnostics || [];
      compileStore.setCompileDiagnostics(backendDiags);
      const structuredParsedLog = diagnosticsToParsedLog(backendDiags);
      if (rawLog && backendDiags.length > 0) {
        cacheBackendParsedLog(rawLog, structuredParsedLog);
      }
      compileStore.setParsedLog(structuredParsedLog);

      const formattedErrors = normalizeEditorDiagnostics(
        backendDiags.length > 0 ? backendDiags : res.errors || [],
        true,
      );

      compileStore.setCompileErrors(formattedErrors);
      diagnosticsCoordinator.ingestCompilerErrors(formattedErrors, resolvedMainFile);

      if (res.flushedFileIds && res.flushedFileIds.length > 0) {
        res.flushedFileIds.forEach((fid: string) => compileStore.clearDirty(fid));
      }

      editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: false });
      this.scheduleNextPendingCompile(currentController);
      return false;
    } catch (err) {
      if (isNetworkError(err)) {
        useConnectivityStore.getState().recordOffline();
        useConnectivityStore.getState().setOfflinePendingCompile(true);
        sessionCoordinator.flushPendingUnsyncedEdits();
        this.pendingCompileOptions = undefined;
        compileStore.setPendingCompile(false);
        compileStore.setCompileStatus('idle');
        compileStore.setCompileLog(
          '[Offline Mode] Network connection lost during compilation request.\n' +
          'Your draft is saved locally and will automatically recompile when reconnected.',
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
        this.isCompiling = false;
        if (useCompileStore.getState().compileStatus === 'compiling') {
          useCompileStore.getState().setCompileStatus('idle');
        }
      }
    }
  }

  public async forceSync(projectId?: string): Promise<{ synced: string[] }> {
    const targetId =
      projectId ||
      (this.options.getProjectId ? this.options.getProjectId() : undefined) ||
      usePageStore.getState().spaceId ||
      usePageStore.getState().projectId ||
      '';
    if (!targetId) return { synced: [] };

    useCompileStore.getState().setCompileStatus('syncing');
    try {
      const res = this.compilerEngine.forceSync
        ? await this.compilerEngine.forceSync(targetId)
        : await CompilePipeline.forceSync(targetId);
      await this.compile();
      return res;
    } catch (err) {
      useCompileStore.getState().setCompileStatus('error');
      throw err;
    }
  }

  public stop(): void {
    const pageStore = usePageStore.getState();
    const compileStore = useCompileStore.getState();
    const activeDoc = pageStore.getActiveDocument();
    const targetProjectId =
      (this.options.getProjectId ? this.options.getProjectId() : undefined) ||
      extractProjectId(activeDoc) ||
      pageStore.projectId ||
      pageStore.rootPageId ||
      pageStore.parentPageId ||
      pageStore.currentPage?.id ||
      pageStore.spaceId ||
      undefined;
    this.pendingCompileOptions = undefined;
    compileStore.setPendingCompile(false);
    this.compileAbortController?.abort();
    this.compileAbortController = null;
    if (targetProjectId) {
      this.compilerEngine.cancelInFlightCompile(targetProjectId);
    }
    this.isCompiling = false;
    compileStore.setCompileStatus('idle');
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
    pageId?: string,
  ): Promise<{ sourcePath: string | null; line: number } | null> {
    if (this.compilerEngine.resolveReverseRemote) {
      return this.compilerEngine.resolveReverseRemote(projectId, pageNum, x, y, pageId);
    }
    return CompilePipeline.resolveReverseRemote(projectId, pageNum, x, y, pageId);
  }

  public async resolveForwardRemote(
    projectId: string,
    file: string,
    line: number,
    column: number = 0,
    pageId?: string,
  ) {
    if (this.compilerEngine.resolveForwardRemote) {
      return this.compilerEngine.resolveForwardRemote(projectId, file, line, column, pageId);
    }
    return CompilePipeline.resolveForwardRemote(projectId, file, line, column, pageId);
  }

  /** Releases compiler resources and clears SyncTeX caches for GC. */
  public dispose(): void {
    this.stop();
    this.synctexMap = null;
    this.rawSynctex = null;
    this.pendingCompileOptions = undefined;
  }
}

export const compilerCoordinator = new CompilerCoordinator();
