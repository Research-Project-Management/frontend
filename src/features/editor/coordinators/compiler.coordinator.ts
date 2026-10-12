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

import { LatexCompilerEngine } from './compilation-pipeline';
import {
  resolveForwardDetail,
  resolveForward,
  resolveReverse,
  type SyncTeXMap,
} from '../domain/pdf/synctex-index';
import {
  assembleCompilationSnapshot,
  type ProjectCompilationSnapshot,
  type SnapshotProjectFile,
} from '../domain/document/compilation-snapshot';
import { latexDagEngine } from '../domain/latex/latex-dag-engine';
import { lruDocumentCache } from '../domain/document/lru-document-cache';
import { workspaceCoordinator } from './workspace.coordinator';
import { diagnosticsCoordinator } from './diagnostics.coordinator';
import { sessionCoordinator } from './session.coordinator';
import { editorCommandBus } from './command-bus';
import { useCompileStore } from '../store/compiler.store';
import { usePageStore } from '../store/editor.store';
import { useSettingsStore } from '../store/settings.store';
import { useConnectivityStore } from '../store/connectivity.store';
import { getActiveEditorContent, getActiveEditorEngine, getActivePdfViewer } from './command-bus';
import type { CompileError, CompileStatus } from '../domain/types/compiler.types';
import { extractProjectId, extractDocumentContentString } from '../domain/types/core.types';
import type { NodeTreeItem } from '../domain/types/node.types';

export interface CreateSnapshotOptions {
  rootFileId?: string;
  resolvedMainFile?: string;
  projectFiles?: SnapshotProjectFile[];
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
    const activeContent = getActiveEditorContent() || (activeDoc?.content as string) || '';

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
      if (cmd.status && ['idle', 'flushing', 'compiling', 'syncing', 'success', 'error', 'aborted'].includes(cmd.status)) {
        useCompileStore.getState().setCompileStatus(cmd.status as CompileStatus);
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
        '[Offline Mode] Bạn đang ngoại tuyến. Các thay đổi đã được lưu an toàn vào bộ nhớ máy (IndexedDB).\n' +
        'Quá trình biên dịch đã được xếp hàng và sẽ tự động bắt đầu ngay khi kết nối mạng được khôi phục.'
      );
      editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
      return false;
    }

    // 1. Guard against overlapping compilations: cancel previous in-flight job and queue next
    if (this.isCompiling || compileStore.compileStatus === 'compiling') {
      compileStore.setPendingCompile(true);
      LatexCompilerEngine.cancelInFlightCompile();
      return false;
    }
    this.isCompiling = true;

    // 2. Non-blocking background auto-save (fires asynchronously in background, never delays compilation)
    void sessionCoordinator.flushAllPending().catch(() => {});

    // 3. Notify start of compilation
    editorCommandBus.dispatch({ type: 'compiler:started' });
    compileStore.setCompileStatus('compiling');

    const effectiveActiveFileId = activeDoc?.id || rootPageId;
    const activeTitle = pageStore.getActiveDocumentTitle();
    const currentVal = getActiveEditorContent() || extractDocumentContentString(activeDoc?.content);
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

    const effectiveProjectId = extractProjectId(activeDoc) || pageStore.projectId || '';

    // 6. Create an atomic in-memory snapshot across open tabs & editor buffer (0ms latency)
    const snapshot = CompilationSnapshotProvider.createSnapshot({
      rootFileId: inferred.rootFileId || activeDoc?.id || pageStore.projectId,
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

        // Asynchronously update synctexMap when non-blocking parser resolves
        if (res.synctexPromise) {
          res.synctexPromise.then((map) => {
            if (map) {
              this.synctexMap = map;
              editorCommandBus.dispatch({ type: 'synctex:map-updated', map });
            }
          });
        }

        const sanitizeDash = (s?: string) => (s ? s.replace(/[\u2014\u2013]/g, '-') : '');
        const nonErrorDiagnostics: CompileError[] =
          res.diagnostics && res.diagnostics.length > 0
            ? res.diagnostics
                .filter((d) => d.severity !== 'error')
                .map((d) => ({
                  line: d.line,
                  message: sanitizeDash(d.message),
                  context: sanitizeDash(d.context || ''),
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
        const isAborted =
          res.error === 'Compilation superseded' ||
          res.error === 'Compilation stopped' ||
          res.error?.toLowerCase().includes('aborted') ||
          res.logs?.toLowerCase().includes('signal is aborted');

        if (isAborted) {
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

        const sanitizeDash = (s?: string) => (s ? s.replace(/[\u2014\u2013]/g, '-') : '');

        const formattedErrors: CompileError[] =
          res.diagnostics && res.diagnostics.length > 0
            ? res.diagnostics.map((d) => ({
                line: d.line,
                message: sanitizeDash(d.message),
                context: sanitizeDash(d.context || ''),
                file: d.file,
                severity: d.severity,
                code: d.code,
                suggestion: d.suggestion,
              }))
            : (res.errors || []).map((err) => ({
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
      const isNetworkError =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        (err instanceof Error && /network|fetch|failed to fetch|offline/i.test(err.message));

      if (isNetworkError) {
        useConnectivityStore.getState().recordOffline();
        useConnectivityStore.getState().setOfflinePendingCompile(true);
        sessionCoordinator.flushPendingDrafts();
        compileStore.setCompileStatus('idle');
        compileStore.setCompileLog(
          '[Offline Mode] Mất kết nối mạng trong quá trình gửi yêu cầu biên dịch.\n' +
          'Bản nháp đã được lưu cục bộ và sẽ tự động biên dịch lại khi có mạng.'
        );
        editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: true });
      } else {
        compileStore.setCompileStatus('error');
        editorCommandBus.dispatch({ type: 'compiler:finished', success: false, aborted: false });
      }
      return false;
    } finally {
      this.isCompiling = false;
      if (useCompileStore.getState().compileStatus === 'compiling') {
        useCompileStore.getState().setCompileStatus('idle');
      }
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
  ): SyncTeXReverseDetail | null {
    const map = synctexMapOverride !== undefined ? synctexMapOverride : this.synctexMap;
    return resolveReverse(clickFraction, pageNum, map, ptX, ptY);
  }

  public async resolveReverseRemote(
    projectId: string,
    pageNum: number,
    x: number,
    y: number,
  ): Promise<{ sourcePath: string | null; line: number } | null> {
    return LatexCompilerEngine.resolveReverseRemote(projectId, pageNum, x, y);
  }

  public async resolveForwardRemote(
    projectId: string,
    file: string,
    line: number,
    column: number = 0,
  ) {
    return LatexCompilerEngine.resolveForwardRemote(projectId, file, line, column);
  }
}

export const compilerCoordinator = new CompilerCoordinatorRegistry();
// Backward compatibility alias
export const compilerLifecycleCoordinator = compilerCoordinator;
