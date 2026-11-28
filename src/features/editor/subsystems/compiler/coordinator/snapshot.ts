/**
 * compilation-snapshot.provider.ts
 *
 * Atomic compilation snapshot assembly, DAG file node registration, diagnostic
 * normalization, and dirty-file payload construction for CompilerCoordinator.
 */

import {
  getActiveEditorContent,
  getAllRegisteredEngines,
  getEditorEngineForFile,
} from '@/features/editor/core/bus/engine-registry';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { workspaceCoordinator } from '@/features/editor/core/coordinator/workspace.coordinator';
import { documentFacade } from '@/features/editor/core/coordinator/document.facade';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import {
  assembleCompilationSnapshot,
  type ProjectCompilationSnapshot,
  type SnapshotProjectFile,
} from '@/features/editor/domain/document/compilation-snapshot';
import { latexDependencyGraph } from '@/features/editor/domain/latex/dependency-graph';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import type { CompileError } from '@/features/editor/domain/types/compiler.types';
import {
  extractDocumentContentString,
  type NodeTreeItem,
  type Page,
  type PageFile,
} from '@/features/editor/domain/types/core.types';
import { useCompileStore } from '../store/compiler.store';

const EM_EN_DASH_REGEX = /[\u2014\u2013]/g;
const BOX_WARNING_MSG_REGEX = /^(Overfull|Underfull)\s*\\[hv]box/i;

function sanitizeDash(s?: string): string {
  return s ? s.replace(EM_EN_DASH_REGEX, '-') : '';
}

export function normalizeEditorDiagnostics(
  items: ReadonlyArray<CompileError>,
  excludeBoxWarnings = false,
): CompileError[] {
  return items
    .filter((d) => {
      if (d.severity === 'info' || d.severity === 'badbox') return false;
      if (excludeBoxWarnings && BOX_WARNING_MSG_REGEX.test(d.message || '')) return false;
      return true;
    })
    .map((d) => ({
      line: d.line,
      message: sanitizeDash(d.message),
      context: sanitizeDash(d.context || ''),
      file: d.file,
      severity: d.severity === 'badbox' ? 'info' : d.severity,
      code: d.code,
      suggestion: d.suggestion,
    }));
}

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
  const wsFiles = workspaceCoordinator.getProjectFiles() || [];
  for (const wf of wsFiles) {
    add(wf.id, wf.path || wf.title || wf.name);
  }
  const stack: NodeTreeItem[] = [...(pageStore.fileHierarchy ?? [])];
  while (stack.length > 0) {
    const node = stack.pop()!;
    add(node.id, node.title);
    if (node.children?.length) stack.push(...node.children);
  }
  return map;
}

export class SnapshotProvider {
  public static createSnapshot(options: CreateSnapshotOptions = {}): ProjectCompilationSnapshot {
    const pageStore = usePageStore.getState();
    const compileStore = useCompileStore.getState();

    const activeDoc = pageStore.getActiveDocument();
    const targetFileId = activeDoc?.id || options.rootFileId;
    const targetEngine = targetFileId ? getEditorEngineForFile?.(targetFileId) : null;
    const registeredCount = getAllRegisteredEngines?.()?.size ?? 0;
    const fallbackActiveContent =
      registeredCount === 0 && targetFileId === activeDoc?.id ? getActiveEditorContent() : null;
    const activeContent =
      options.activeContentOverride ||
      targetEngine?.getContent?.() ||
      fallbackActiveContent ||
      (targetFileId ? lruDocumentCache.getContent(targetFileId) : undefined) ||
      extractDocumentContentString(activeDoc?.content);

    const wsFiles = workspaceCoordinator.getProjectFiles();
    const baseFiles =
      options.projectFiles ||
      (wsFiles && wsFiles.length > 0 ? wsFiles : documentFacade.getOverlayFiles()) ||
      [];
    const lruModels = lruDocumentCache.getAllModels();
    const dirtyFiles = compileStore.getDirtyFiles();
    const filePathsById = buildPageStoreFilePaths(pageStore);

    const liveEngineBuffers: Array<{ fileId: string; filePath: string; content: string }> = [];
    const registeredEngines = getAllRegisteredEngines?.();
    if (registeredEngines && registeredEngines.size > 0) {
      for (const [fId, eng] of registeredEngines.entries()) {
        if (!fId) continue;
        const liveContent = eng?.getContent?.();
        if (typeof liveContent === 'string') {
          const model = lruDocumentCache.getModel(fId);
          const wsFile = baseFiles.find((f) => f.id === fId);
          // Avoid clobbering non-empty persisted content with a transient empty buffer
          // during zero-remount tab swaps when the file is not locally dirty.
          const hasNonEmptyFallback = Boolean(
            (model?.content && model.content.length > 0) ||
              (wsFile?.content && extractDocumentContentString(wsFile.content).length > 0),
          );
          if (liveContent.length === 0 && !lruDocumentCache.isDirty(fId) && hasNonEmptyFallback) {
            continue;
          }
          const fPath =
            model?.filePath ||
            wsFile?.path ||
            wsFile?.title ||
            filePathsById[fId] ||
            (fId === activeDoc?.id ? activeDoc?.path || activeDoc?.title : undefined) ||
            fId;
          liveEngineBuffers.push({
            fileId: fId,
            filePath: fPath,
            content: liveContent,
          });
        }
      }
    }

    return assembleCompilationSnapshot({
      baseFiles,
      lruModels,
      dirtyFiles,
      liveEngineBuffers,
      currentPage: pageStore.currentPage,
      activeDoc,
      activeContent,
      rootFileId: options.rootFileId,
      resolvedMainFile: options.resolvedMainFile,
      filePathsById,
    });
  }
}

export function updateDagNodesAndAliases(params: {
  pageStore: ReturnType<typeof usePageStore.getState>;
  effectiveActiveFileId: string;
  activeDoc: Page | PageFile | null;
  activeTitle: string;
  currentVal: string;
  preferredMainFile?: string;
}) {
  const {
    pageStore,
    effectiveActiveFileId,
    activeDoc,
    activeTitle,
    currentVal,
    preferredMainFile,
  } = params;

  const allFilePathsById = buildPageStoreFilePaths(pageStore);
  const allModels = lruDocumentCache.getAllModels();
  for (const m of allModels) {
    latexDependencyGraph.updateFileNode(m.fileId, m.filePath || m.fileId, m.content);
  }
  if (activeDoc && activeDoc.content) {
    const cTitle = activeDoc.title || 'main.tex';
    const cContent = extractDocumentContentString(activeDoc.content);
    latexDependencyGraph.updateFileNode(activeDoc.id, cTitle, cContent);
  }
  const registeredEngines = getAllRegisteredEngines?.();
  if (registeredEngines && registeredEngines.size > 0) {
    const wsFiles = workspaceCoordinator.getProjectFiles() || [];
    for (const [fId, eng] of registeredEngines.entries()) {
      if (!fId) continue;
      const liveText = eng?.getContent?.();
      if (typeof liveText === 'string') {
        const model = lruDocumentCache.getModel(fId);
        const wsFile = wsFiles.find((f) => f.id === fId);
        const fPath =
          model?.filePath ||
          wsFile?.path ||
          wsFile?.title ||
          allFilePathsById[fId] ||
          (fId === effectiveActiveFileId ? activeTitle : fId);
        latexDependencyGraph.updateFileNode(fId, fPath, liveText);
      }
    }
  }
  if (effectiveActiveFileId) {
    latexDependencyGraph.updateFileNode(effectiveActiveFileId, activeTitle, currentVal);
  }

  const inferred = latexDependencyGraph.inferRootDocument(
    effectiveActiveFileId,
    preferredMainFile,
  );
  const resolvedMainFile = inferred.rootPath;

  if (activeTitle && effectiveActiveFileId) {
    diagnosticsCoordinator.registerAlias(activeTitle, effectiveActiveFileId);
  }
  if (resolvedMainFile) {
    diagnosticsCoordinator.registerAlias(resolvedMainFile, resolvedMainFile);
  }
  if (resolvedMainFile && inferred.rootFileId) {
    diagnosticsCoordinator.registerAlias(resolvedMainFile, inferred.rootFileId);
  }
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

  return {
    allFilePathsById,
    resolvedMainFile,
    rootFileId: inferred.rootFileId,
    hasCycleWarning: inferred.hasCycleWarning,
  };
}

export function buildCompileDirtyFilesPayload(
  dirtyFileIds: string[],
  allFilePathsById: Record<string, string>,
  snapshotFiles: Record<string, string>,
  dirtyContentMap: Map<string, string>,
) {
  return dirtyFileIds.map((id: string) => {
    const resolvedPath =
      allFilePathsById[id] ||
      lruDocumentCache.getModel(id)?.filePath ||
      undefined;
    return {
      fileId: id,
      path: resolvedPath && resolvedPath !== id ? resolvedPath : undefined,
      content:
        lruDocumentCache.getContent(id) ??
        dirtyContentMap.get(id) ??
        (resolvedPath ? snapshotFiles[resolvedPath] : undefined) ??
        snapshotFiles[id] ??
        '',
    };
  });
}
