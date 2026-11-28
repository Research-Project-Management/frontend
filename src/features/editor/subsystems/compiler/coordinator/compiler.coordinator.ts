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

import { logger } from '@/shared/lib/logger';
import { CompilePipeline, type CompilerDiagnostic, type CompilerPort } from './pipeline';
import { DEFAULT_COMPILER_ENGINE } from '@/features/editor/domain/types/compiler.types';
import { FlushBarrier } from './flush-barrier';
import {
  resolveForwardDetail,
  resolveForward,
  resolveReverse,
  type SyncTeXMap,
} from '../synctex/synctex';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  diagnosticsCoordinator,
  hasHardSyntaxErrors,
  type IndexedDiagnosticItem,
  type FileDiagnosticsSummary,
} from '@/features/editor/subsystems/diagnostics';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import {
  getActiveEditorContent,
  getActiveEditorEngine,
  getActivePdfViewer,
  getAllRegisteredEngines,
  getEditorEngineForFile,
} from '@/features/editor/core/bus/engine-registry';
import { resolveEditorScopeFromState } from '@/features/editor/core/coordinator/editor-scope';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { getIsOnline } from '@/shared/lib/network';
import { useCompileStore } from '../store/compiler.store';
import { isCompilerFsmRunning } from '@/features/editor/domain/document/compiler-fsm';
import { multiTabBus } from '@/shared/lib/multi-tab';
import type {
  CompileOutcome,
  CompileReport,
  CompileStatus,
} from '@/features/editor/domain/types/compiler.types';
import {
  extractDocumentContentString,
  extractProjectId,
} from '@/features/editor/domain/types/core.types';
import {
  isCompileNetworkError as isNetworkError,
  resolveDiagnosticsWithSummary,
  VALID_COMPILE_STATUSES,
} from '../model/compile-diagnostics.mapper';
import {
  SnapshotProvider,
  buildPageStoreFilePaths,
  normalizeEditorDiagnostics,
  updateDagNodesAndAliases,
  buildCompileDirtyFilesPayload,
  type CreateSnapshotOptions,
} from './snapshot';

export { SnapshotProvider, buildPageStoreFilePaths, type CreateSnapshotOptions };

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
  private activeRunId: number | null = null;
  private compileAbortController: AbortController | null = null;
  private pendingCompileOptions: CompileOptions | undefined = undefined;
  private synctexMap: SyncTeXMap | null = null;
  private initialized = false;

  /** Injected Compiler Engine (CompilePipeline by default) */
  private compilerEngine: CompilerPort;
  private readonly options: CompilerCoordinatorOptions;

  constructor(options: CompilerCoordinatorOptions = {}) {
    this.options = options;
    this.compilerEngine = options.compilerEngine || CompilePipeline;
    this.initCommandSubscriptions();
  }

  private finalizeRun(runId: number, completedController: AbortController): void {
    if (this.compileAbortController === completedController) {
      this.compileAbortController = null;
    }
    if (this.activeRunId === runId) {
      this.activeRunId = null;
    }

    const compileStore = useCompileStore.getState();
    if (!compileStore.compilerFsm.hasPendingRun) {
      return;
    }

    const nextOpts = this.pendingCompileOptions;
    this.pendingCompileOptions = undefined;
    compileStore.dispatchCompileEvent({ type: 'CONSUME_PENDING' });

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
        reason: (cmd.reason as CompileOptions['reason']) ?? 'shortcut',
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

    editorCommandBus.subscribe('compiler:progress', (cmd) => {
      // Citation: Overleaf `services/web/frontend/js/shared/context/local-compile-context.tsx` (line 168)
      // & `services/web/frontend/js/features/pdf-preview/util/compiler.ts` (line 115):
      // Compilation status is strictly scoped to the user/client session that initiated an active
      // compile (`this.activeRunId !== null`). Collaborators viewing the same project must NOT
      // have their screen hijacked into a `Compiling...` state when another user compiles.
      if (this.activeRunId === null) {
        return;
      }
      const compileStore = useCompileStore.getState();
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
          compileStore.dispatchCompileEvent({
            type: 'REMOTE_PROGRESS',
            status: mappedStatus as CompileStatus,
          });
        }
      }
      if (cmd.logs && cmd.logs.length > 0) {
        const chunk = cmd.logs.join('\n');
        if (cmd.status === 'compiling' || cmd.status === 'queued') {
          compileStore.appendCompileLog(chunk);
        } else if (!this.activeRunId && !compileStore.compileReport?.logText) {
          compileStore.setCompileLog(chunk);
        }
      }
    });

    multiTabBus.subscribe((msg) => {
      if (msg.type === 'EDITOR_COMPILATION_COMPLETED') {
        const activeScopeId = resolveEditorScopeFromState(usePageStore.getState()).effectiveScopeId;
        if (activeScopeId && activeScopeId === msg.projectId) {
          if (!this.getIsCompiling() && msg.status === 'success' && msg.pdfUrl) {
            const compileStore = useCompileStore.getState();
            compileStore.setPdfUrl(msg.pdfUrl);
            compileStore.dispatchCompileEvent({ type: 'REMOTE_COMPLETED' });
            compileStore.setLastCompiledAt(new Date(msg.timestamp));
          }
        }
      }
    });
  }

  public getIsCompiling(): boolean {
    return (
      this.activeRunId !== null ||
      isCompilerFsmRunning(useCompileStore.getState().compilerFsm)
    );
  }

  public getSynctexMap(): SyncTeXMap | null {
    return this.synctexMap;
  }

  public setSynctexMap(map: SyncTeXMap | null): void {
    this.synctexMap = map;
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
    const scope = resolveEditorScopeFromState(pageStore);
    const rootPageId = scope.rootPageId || activeDoc?.id || null;

    if (!rootPageId) {
      return false;
    }

    const fallbackMainFile =
      activeDoc?.path || activeDoc?.title || pageStore.mainFilePath || 'main.tex';

    if (!getIsOnline()) {
      compileStore.dispatchCompileEvent({
        type: 'BLOCKED_OFFLINE',
        mainFile: fallbackMainFile,
        logText:
          'You are currently offline. Reconnect to compile this document on the server.',
      });
      editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
      return false;
    }

    const isAutoCompileReason =
      options?.reason === 'auto' || options?.reason === 'auto-compile';
    if (isAutoCompileReason && settingsStore.stopOnValidationError) {
      const activeFilePathOrId =
        activeDoc?.path || activeDoc?.title || activeDoc?.id || pageStore.getActiveDocumentTitle();
      if (activeFilePathOrId) {
        const fileDiags = diagnosticsCoordinator.getDiagnosticsForFile(activeFilePathOrId, false);
        const linterItems = fileDiags.filter(
          (d) => d.source === 'LaTeX Linter' || d.source === 'linter',
        );
        if (hasHardSyntaxErrors(linterItems)) {
          compileStore.dispatchCompileEvent({
            type: 'BLOCKED_CODE_CHECK',
            mainFile: activeFilePathOrId,
          });
          return false;
        }
      }
    }

    if (this.getIsCompiling()) {
      compileStore.dispatchCompileEvent({ type: 'QUEUE_SUPERSEDE' });
      this.pendingCompileOptions = {
        ...this.pendingCompileOptions,
        ...options,
        forceClean: options?.forceClean || this.pendingCompileOptions?.forceClean,
      };
      this.compileAbortController?.abort();
      const cancelTargetId =
        scope.rootPageId ||
        (this.options.getProjectId ? this.options.getProjectId() : undefined) ||
        extractProjectId(activeDoc) ||
        scope.effectiveScopeId ||
        undefined;
      this.compilerEngine.cancelInFlightCompile(cancelTargetId);
      return false;
    }

    const startedFsm = compileStore.dispatchCompileEvent({ type: 'START_FLUSH' });
    if (startedFsm.activeRunId === null) {
      return false;
    }
    const runId = startedFsm.activeRunId;
    this.activeRunId = runId;
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

    if (currentController.signal.aborted || this.activeRunId !== runId) {
      const stillActiveInFsm = useCompileStore.getState().compilerFsm.activeRunId === runId;
      compileStore.dispatchCompileEvent({
        type: 'RUN_ABORTED',
        runId,
        mainFile: fallbackMainFile,
      });
      if (stillActiveInFsm) {
        editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
      }
      this.finalizeRun(runId, currentController);
      return false;
    }

    compileStore.dispatchCompileEvent({ type: 'FLUSH_COMPLETE', runId });
    editorCommandBus.dispatch({ type: 'compiler:started' });

    const preferredMainFile = this.options.getMainFile
      ? this.options.getMainFile()
      : (pageStore.mainFilePath ?? undefined);

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
      logger.warn('[CompilerCoordinator] Circular include dependency detected in LaTeX project DAG');
    }

    const effectiveProjectId =
      (this.options.getProjectId ? this.options.getProjectId() : undefined) ||
      extractProjectId(activeDoc) ||
      scope.spaceId ||
      (scope.rootPageId ? scope.routeSpaceParam : '');

    const isBibFile = activeTitle.toLowerCase().endsWith('.bib');
    const safeRootFileId =
      rootFileId ||
      scope.rootPageId ||
      (!isBibFile ? activeDoc?.id : undefined) ||
      scope.projectId;

    const snapshot = SnapshotProvider.createSnapshot({
      rootFileId: safeRootFileId,
      resolvedMainFile,
    });

    try {
      const res = await this.compilerEngine.compile({
        projectId: effectiveProjectId,
        pageId: rootPageId,
        mainFile: resolvedMainFile,
        source: snapshot.source,
        files: snapshot.files,
        engine: this.options.getEngine?.() || settingsStore.engine || DEFAULT_COMPILER_ENGINE,
        texLiveVersion: this.options.getTexLiveVersion?.() || settingsStore.texLiveVersion,
        draft: options?.draft ?? (settingsStore.compileMode === 'draft'),
        useCache: options?.forceClean ? false : settingsStore.useCache,
        forceClean: options?.forceClean,
        stopOnFirstError: settingsStore.stopOnFirstError,
        priority: isAutoCompileReason ? 'auto' : 'manual',
        dirtyFiles: buildCompileDirtyFilesPayload(
          snapshot.dirtyFileIds,
          allFilePathsById,
          snapshot.files,
          compileStore.dirtyContentMap,
        ),
        signal: currentController.signal,
        onPhaseChange: (phase: string) => {
          if (this.activeRunId === runId && VALID_COMPILE_STATUSES.has(phase as CompileStatus)) {
            compileStore.dispatchCompileEvent({
              type: 'REMOTE_PROGRESS',
              status: phase as CompileStatus,
            });
          }
          editorCommandBus.dispatch({ type: 'compiler:progress', status: phase });
        },
        onThumbnailGenerated: (base64: string) => {
          const dataUrl = `data:image/jpeg;base64,${base64}`;
          options?.onThumbnailGenerated?.(dataUrl);
        },
      });

      if (currentController.signal.aborted || this.activeRunId !== runId) {
        const stillActiveInFsm = useCompileStore.getState().compilerFsm.activeRunId === runId;
        compileStore.dispatchCompileEvent({
          type: 'RUN_ABORTED',
          runId,
          mainFile: resolvedMainFile,
          logText: (res.logs ?? res.rawLog ?? '') || null,
          serverTerminated: res.outcome === 'terminated',
        });
        if (stillActiveInFsm) {
          editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
        }
        this.finalizeRun(runId, currentController);
        return false;
      }

      if (res.success) {
        compileStore.setPdfUrl(res.pdfUrl ?? null);
        this.synctexMap = res.synctexMap ?? null;

        const rawLog = res.logs ?? res.rawLog ?? '';
        const backendDiags = res.diagnostics || [];
        const compiledAt =
          res.compiledAt instanceof Date
            ? res.compiledAt
            : typeof res.compiledAt === 'number'
              ? new Date(res.compiledAt)
              : new Date();
        const { diagnostics: effectiveDiagnostics, summary } = resolveDiagnosticsWithSummary({
          backendDiags,
          rawLog,
          mainFile: resolvedMainFile,
          backendSummary: res.diagnosticsSummary,
        });

        const report: CompileReport = {
          outcome: res.outcome || 'success',
          errorMessage: null,
          diagnostics: effectiveDiagnostics,
          summary,
          validationIssues: [],
          logText: rawLog || null,
          logMeta: res.logMeta ?? null,
          compiledAt,
          mainFile: resolvedMainFile,
        };
        compileStore.dispatchCompileEvent({
          type: 'RUN_SETTLED',
          runId,
          report,
        });

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

        const successDiagnostics = normalizeEditorDiagnostics(effectiveDiagnostics, false);
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
        const latestScope = resolveEditorScopeFromState(usePageStore.getState());
        const activeScopeId =
          (this.options.getProjectId ? this.options.getProjectId() : undefined) ||
          latestScope.effectiveScopeId ||
          effectiveProjectId;
        if (activeScopeId) {
          multiTabBus.broadcast({
            type: 'EDITOR_COMPILATION_COMPLETED',
            projectId: activeScopeId,
            pdfUrl: res.pdfUrl ?? null,
            status: 'success',
            timestamp: Date.now(),
          });
        }
        this.finalizeRun(runId, currentController);
        return true;
      }

      const rawLog = res.logs ?? res.rawLog ?? '';
      const isAborted =
        res.aborted ||
        res.status === 'aborted' ||
        res.outcome === 'terminated' ||
        currentController.signal.aborted ||
        res.error === 'Compilation superseded' ||
        res.error === 'Compilation stopped' ||
        res.error?.toLowerCase().includes('aborted') ||
        rawLog.toLowerCase().includes('signal is aborted');

      if (isAborted) {
        const stillActiveInFsm = useCompileStore.getState().compilerFsm.activeRunId === runId;
        compileStore.dispatchCompileEvent({
          type: 'RUN_ABORTED',
          runId,
          mainFile: resolvedMainFile,
          logText: rawLog || null,
          serverTerminated: res.outcome === 'terminated',
        });
        if (stillActiveInFsm) {
          editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
        }
        this.finalizeRun(runId, currentController);
        return false;
      }

      if (res.pdfUrl) {
        compileStore.setPdfUrl(res.pdfUrl);
        this.synctexMap = res.synctexMap ?? null;
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
      }

      const failOutcome: CompileOutcome =
        res.outcome ||
        (settingsStore.stopOnFirstError ? 'stopped-on-first-error' : 'failure');
      const isNonCodeOutcome =
        failOutcome === 'validation-problems' ||
        failOutcome === 'clsi-unavailable' ||
        failOutcome === 'rate-limited';
      const { diagnostics: effectiveFailureDiags, summary: failSummary } = isNonCodeOutcome
        ? {
            diagnostics: [] as CompilerDiagnostic[],
            summary: res.diagnosticsSummary ?? {
              totalErrors: 0,
              totalWarnings: 0,
              totalBadboxes: 0,
              suppressedCascadeCount: 0,
              truncated: false,
            },
          }
        : resolveDiagnosticsWithSummary({
            backendDiags: res.diagnostics || [],
            fallbackErrors: res.errors,
            rawLog,
            mainFile: resolvedMainFile,
            backendSummary: res.diagnosticsSummary,
          });

      compileStore.dispatchCompileEvent({
        type: 'RUN_SETTLED',
        runId,
        report: {
          outcome: failOutcome,
          errorMessage: res.error || 'LaTeX compilation failed.',
          diagnostics: effectiveFailureDiags,
          summary: failSummary,
          validationIssues: res.validationIssues ?? [],
          logText: rawLog || null,
          logMeta: res.logMeta ?? null,
          compiledAt: null,
          mainFile: resolvedMainFile,
        },
      });

      if (failOutcome === 'validation-problems') {
        diagnosticsCoordinator.ingestCompilerErrors([], resolvedMainFile);
      } else if (
        failOutcome !== 'clsi-unavailable' &&
        failOutcome !== 'rate-limited'
      ) {
        const formattedErrors = normalizeEditorDiagnostics(effectiveFailureDiags, true);
        diagnosticsCoordinator.ingestCompilerErrors(formattedErrors, resolvedMainFile);
      }

      if (res.flushedFileIds && res.flushedFileIds.length > 0) {
        res.flushedFileIds.forEach((fid: string) => compileStore.clearDirty(fid));
      }

      editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: false });
      this.finalizeRun(runId, currentController);
      return false;
    } catch (err) {
      if (currentController.signal.aborted || this.activeRunId !== runId) {
        const stillActiveInFsm = useCompileStore.getState().compilerFsm.activeRunId === runId;
        compileStore.dispatchCompileEvent({
          type: 'RUN_ABORTED',
          runId,
          mainFile: resolvedMainFile,
        });
        if (stillActiveInFsm) {
          editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
        }
        this.finalizeRun(runId, currentController);
        return false;
      }

      if (isNetworkError(err)) {
        this.pendingCompileOptions = undefined;
        compileStore.dispatchCompileEvent({
          type: 'BLOCKED_OFFLINE',
          runId,
          mainFile: resolvedMainFile,
          logText:
            'Network connection lost during compilation request. Reconnect and retry.',
        });
        editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
        this.finalizeRun(runId, currentController);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        compileStore.dispatchCompileEvent({
          type: 'RUN_SETTLED',
          runId,
          report: {
            outcome: 'clsi-unavailable',
            errorMessage: msg || 'Compilation service unavailable',
            diagnostics: [],
            summary: {
              totalErrors: 0,
              totalWarnings: 0,
              totalBadboxes: 0,
              suppressedCascadeCount: 0,
              truncated: false,
            },
            validationIssues: [],
            logText: msg || null,
            logMeta: null,
            compiledAt: null,
            mainFile: resolvedMainFile,
          },
        });
        editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: false });
        this.finalizeRun(runId, currentController);
      }
      return false;
    } finally {
      if (this.compileAbortController === currentController) {
        this.compileAbortController = null;
      }
      if (this.activeRunId === runId) {
        this.activeRunId = null;
      }
      if (useCompileStore.getState().compilerFsm.activeRunId === runId) {
        useCompileStore.getState().dispatchCompileEvent({
          type: 'RUN_ABORTED',
          runId,
          mainFile: resolvedMainFile,
        });
      }
    }
  }

  public async forceSync(projectId?: string): Promise<{ synced: string[] }> {
    const scope = resolveEditorScopeFromState(usePageStore.getState());
    const targetId =
      projectId ||
      (this.options.getProjectId ? this.options.getProjectId() : undefined) ||
      scope.spaceId ||
      (scope.rootPageId ? scope.routeSpaceParam : '');
    if (!targetId) return { synced: [] };

    const compileStore = useCompileStore.getState();
    compileStore.dispatchCompileEvent({ type: 'SYNC_START' });
    try {
      const res = this.compilerEngine.forceSync
        ? await this.compilerEngine.forceSync(targetId)
        : await CompilePipeline.forceSync(targetId);
      compileStore.dispatchCompileEvent({ type: 'SYNC_END' });
      await this.compile();
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      compileStore.dispatchCompileEvent({
        type: 'SYNC_FAILED',
        errorMessage: msg || 'Sync failed before compilation.',
      });
      throw err;
    }
  }

  public stop(): void {
    const pageStore = usePageStore.getState();
    const compileStore = useCompileStore.getState();
    const activeDoc = pageStore.getActiveDocument();
    const scope = resolveEditorScopeFromState(pageStore);
    const targetCancelId =
      scope.rootPageId ||
      (this.options.getProjectId ? this.options.getProjectId() : undefined) ||
      extractProjectId(activeDoc) ||
      scope.effectiveScopeId ||
      undefined;
    const activeTitle = pageStore.getActiveDocumentTitle();
    const mainFile =
      activeDoc?.path || activeDoc?.title || activeTitle || 'main.tex';

    const wasRunning = this.getIsCompiling();
    this.pendingCompileOptions = undefined;
    this.compileAbortController?.abort();
    this.compileAbortController = null;
    this.activeRunId = null;

    if (targetCancelId) {
      this.compilerEngine.cancelInFlightCompile(targetCancelId);
    }

    compileStore.dispatchCompileEvent({
      type: 'USER_STOP',
      mainFile,
    });

    if (wasRunning) {
      editorCommandBus.dispatch({
        type: 'compiler:finished',
        success: false,
        aborted: true,
      });
    }
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
    this.pendingCompileOptions = undefined;
  }
}

export const compilerCoordinator = new CompilerCoordinator();
