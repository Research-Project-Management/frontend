/**
 * bootstrap.queries.ts
 *
 * Editor Bootstrap Query & Single-Seam Hydration Coordinator.
 */

import { queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  pagesService,
  mapStructureNodesToPageFiles,
  mapStructureNodesToStorageItems,
  type EditorBootstrapResponseDto,
} from '@/features/editor/sdk/pages.service';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { latexDependencyGraph } from '@/features/editor/domain/latex/dependency-graph';
import { normalizeVirtualPath } from '@/features/editor/domain/document/document-naming';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import {
  useSettingsStore,
  normalizeSpellCheckLanguage,
  type CompilerEngine,
} from '@/features/editor/core/store/settings.store';
import { workspaceCoordinator } from '@/features/editor/core/coordinator/workspace.coordinator';
import { useCompileStore } from '@/features/editor/subsystems/compiler';
import {
  extractDocumentContentString,
  type Page,
} from '@/features/editor/domain/types/core.types';
import {
  pageKeys,
  storageKeys,
  DOCUMENT_QUERY_STALE_TIME,
  DOCUMENT_QUERY_GC_TIME,
} from './query-keys';

const inFlightEditorBootstraps = new Map<string, Promise<EditorBootstrapResponseDto | null>>();

export function registerEditorBootstrapPromise(
  keys: Array<string | null | undefined>,
  promise: Promise<EditorBootstrapResponseDto | null>,
): Promise<EditorBootstrapResponseDto | null> {
  const uniqueKeys = Array.from(new Set(keys.filter((k): k is string => Boolean(k && k.trim()))));
  for (const key of uniqueKeys) {
    inFlightEditorBootstraps.set(key, promise);
  }
  return promise.finally(() => {
    for (const key of uniqueKeys) {
      if (inFlightEditorBootstraps.get(key) === promise) {
        inFlightEditorBootstraps.delete(key);
      }
    }
  });
}

export function waitForEditorBootstrap(
  targetId?: string | null,
): Promise<EditorBootstrapResponseDto | null> | null {
  if (!targetId) return null;
  return inFlightEditorBootstraps.get(targetId) ?? null;
}

export function normalizeBootstrapActivePage(data: EditorBootstrapResponseDto): Page {
  const raw = data.activeDoc.page;
  const resolvedProjectId =
    data.workspace.spaceType === 'project' ? data.workspace.spaceId : '';
  const activeHash =
    raw.hash ??
    data.activeDoc.hash ??
    data.tree?.find((n) => (n.docId || n.id) === raw.id)?.hash ??
    null;
  return {
    id: raw.id,
    title: raw.title || data.workspace.mainFilePath || 'main.tex',
    path: raw.path,
    content: raw.content ?? (Array.isArray(data.activeDoc.lines) ? data.activeDoc.lines.join('\n') : ''),
    status: (raw.status as Page['status']) || 'published',
    projectId: resolvedProjectId,
    mainFile: { id: data.workspace.rootDocId, title: data.workspace.mainFilePath },
    mainFileId: data.workspace.rootDocId,
    rootPageId: data.workspace.pageId || data.workspace.rootDocId,
    version: raw.version ?? data.activeDoc.version ?? 1,
    rev: raw.rev ?? data.activeDoc.rev ?? 1,
    hash: activeHash,
    createdAt: raw.createdAt || data.serverTimestamp,
    updatedAt: raw.updatedAt || data.serverTimestamp,
  };
}

/**
 * Single hydration seam distributing a 3-block EditorBootstrap payload into
 * TanStack Query caches, RAM LRU cache, IndexedDB snapshots, symbols index,
 * workspace/page stores, and compiler diagnostics/PDF metadata.
 */
export function hydrateEditorBootstrap(
  queryClient: QueryClient,
  data: EditorBootstrapResponseDto,
  requestedTargetId?: string,
): void {
  const { workspace, tree, activeDoc, symbols, lastBuild, degradedBranches } = data;
  const activePage = normalizeBootstrapActivePage(data);
  const resolvedProjectId = workspace.spaceType === 'project' ? workspace.spaceId : '';
  const effectiveProjectOrSpace = workspace.spaceId;

  if (Array.isArray(tree)) {
    for (const node of tree) {
      if (node.type?.toUpperCase() !== 'DOC') continue;
      const docId = node.docId || node.id;
      if (!docId || docId === activePage.id) continue;
      const ramModel = lruDocumentCache.getModel(docId);
      if (!ramModel || ramModel.isDirty) continue;
      const hashChanged = Boolean(node.hash && ramModel.hash && node.hash !== ramModel.hash);
      const revNewer = Boolean(
        typeof node.rev === 'number' &&
        typeof ramModel.serverRev === 'number' &&
        node.rev > ramModel.serverRev,
      );
      if (hashChanged || revNewer) {
        queryClient.invalidateQueries({ queryKey: pageKeys.detail(docId) });
      }
    }
  }

  // 1. Seed TanStack Query caches for active doc, file list, and structure nodes
  queryClient.setQueryData(pageKeys.detail(activePage.id), activePage);
  if (activeDoc.id === workspace.rootDocId) {
    queryClient.setQueryData(pageKeys.detail(workspace.rootDocId), activePage);
    if (workspace.pageId && workspace.pageId !== workspace.rootDocId) {
      queryClient.setQueryData(pageKeys.detail(workspace.pageId), activePage);
    }
    if (requestedTargetId && requestedTargetId === workspace.rootDocId) {
      queryClient.setQueryData(pageKeys.detail(requestedTargetId), activePage);
    }
  }

  const pageFiles = mapStructureNodesToPageFiles(tree, workspace.rootDocId);
  const fileTargetIds = Array.from(
    new Set(
      [workspace.pageId, workspace.rootDocId, requestedTargetId].filter((id): id is string => Boolean(id)),
    ),
  );
  for (const id of fileTargetIds) {
    queryClient.setQueryData(pageKeys.files(id), pageFiles);
  }

  const storageItems = mapStructureNodesToStorageItems(tree, workspace.spaceId);
  const storageKeysToSeed = [
    storageKeys.files(workspace.pageId, workspace.pageId),
    storageKeys.files(workspace.spaceId, workspace.pageId),
    ...(workspace.rootDocId !== workspace.pageId
      ? [storageKeys.files(workspace.rootDocId, workspace.rootDocId)]
      : []),
    ...(requestedTargetId &&
    (requestedTargetId === workspace.pageId ||
      requestedTargetId === workspace.rootDocId)
      ? [storageKeys.files(requestedTargetId, requestedTargetId)]
      : []),
  ];
  for (const key of storageKeysToSeed) {
    queryClient.setQueryData(key, storageItems);
  }
  workspaceCoordinator.syncStructureItems(storageItems, workspace.pageId);

  // 2. Warm RAM LRU Cache for ONLY the active file (never overwrite dirty buffers)
  const filePath = activePage.path || activePage.title || workspace.mainFilePath || 'main.tex';
  if (!lruDocumentCache.isDirty(activePage.id)) {
    const contentText = extractDocumentContentString(activePage.content);
    const serverRev = activePage.rev ?? data.activeDoc.rev ?? data.activeDoc.page?.rev;
    const activeHash =
      activePage.hash ??
      data.activeDoc.hash ??
      data.activeDoc.page?.hash ??
      null;
    lruDocumentCache.registerModel(activePage.id, {
      content: contentText,
      filePath,
      projectId: effectiveProjectOrSpace,
      spaceId: workspace.spaceId,
      pageId: workspace.pageId,
      ...(typeof serverRev === 'number' ? { serverRev } : {}),
      ...(activeHash !== undefined ? { hash: activeHash } : {}),
      serverUpdatedAt: activePage.updatedAt,
      isAuthoritative: true,
    });
  }

  // 3. Synchronize pure space/project coordinates, titles, GitHub link & role permissions into PageStore
  const pageStore = usePageStore.getState();
  pageStore.setWorkspaceContext({
    spaceId: workspace.spaceId,
    spaceType: workspace.spaceType ?? (resolvedProjectId ? 'project' : 'personal'),
    projectId: resolvedProjectId,
    projectName: workspace.projectName ?? null,
    workspaceTitle: workspace.title,
    permissions: workspace.permissions,
    githubLink: workspace.githubLink ?? null,
  });
  pageStore.setRootPageId(workspace.pageId || workspace.rootDocId);
  const normalizedMainFilePath = normalizeVirtualPath(workspace.mainFilePath || '') || null;
  pageStore.setMainDocument({
    rootDocId: workspace.rootDocId ?? null,
    mainFilePath: normalizedMainFilePath,
  });
  latexDependencyGraph.setServerRootDoc(normalizedMainFilePath, workspace.rootDocId ?? null);

  // 3b. Hydrate active Page build config (compiler, texlive, spellLang) without clobbering UI preferences
  const pageCompiler = data.page?.compiler ?? workspace.compiler ?? activeDoc.page?.compiler;
  const pageTexlive = data.page?.texlive ?? workspace.texlive ?? activeDoc.page?.texlive;
  const pageSpellLang = data.page?.spellLang ?? workspace.spellLang ?? activeDoc.page?.spellLang;

  if (pageCompiler || pageTexlive || pageSpellLang) {
    pageStore.setPageBuildConfig({
      ...(pageCompiler ? { compiler: pageCompiler } : {}),
      ...(pageTexlive ? { texlive: pageTexlive } : {}),
      ...(pageSpellLang ? { spellLang: pageSpellLang } : {}),
    });
    const settingsStore = useSettingsStore.getState();
    const validEngines = new Set(['pdflatex', 'xelatex', 'lualatex', 'latex']);
    if (pageCompiler && validEngines.has(pageCompiler)) {
      settingsStore.setEngine(pageCompiler as CompilerEngine);
    }
    if (typeof pageTexlive === 'string' && pageTexlive.trim()) {
      settingsStore.setTexLiveVersion(pageTexlive.trim());
    }
    if (typeof pageSpellLang === 'string' && pageSpellLang.trim()) {
      const cleanSpell = pageSpellLang.trim();
      if (cleanSpell.toLowerCase() === 'off') {
        settingsStore.setSpellCheck(false);
      } else {
        settingsStore.setSpellCheck(true);
        settingsStore.setSpellCheckLanguage(normalizeSpellCheckLanguage(cleanSpell));
      }
    }
  }

  if (resolvedProjectId) {
    queryClient.setQueryData(['github-link', resolvedProjectId], {
      isConnected: Boolean(workspace.githubLink),
      link: workspace.githubLink ?? null,
    });
  }

  // 4. Hydrate manuscript-page LaTeX symbol catalog if symbols branch succeeded
  if (symbols && !degradedBranches.includes('symbols')) {
    latexSymbolsIndex.hydrateFromDto(symbols, workspace.pageId);
  }

  // 5. Hydrate compiler diagnostics & trigger non-blocking authenticated PDF fetch
  const compileState = useCompileStore.getState();
  if (compileState.compileStatus === 'idle') {
    compileState.setCompileDiagnostics(lastBuild?.diagnostics ?? []);
    compileState.setLastCompiledAt(
      lastBuild?.lastCompiledAt ? new Date(lastBuild.lastCompiledAt) : null,
    );
    if (
      lastBuild?.status === 'ready' &&
      lastBuild.pdfArtifactUrl &&
      !compileState.pdfUrl &&
      typeof pagesService.compiler?.fetchArtifactBlobUrl === 'function'
    ) {
      void pagesService.compiler
        .fetchArtifactBlobUrl(workspace.pageId, 'output.pdf', {
          isPageScoped: true,
        })
        .then((blobUrl) => {
          if (!blobUrl) return;
          const latest = useCompileStore.getState();
          if (latest.compileStatus === 'idle' && !latest.pdfUrl) {
            latest.setPdfUrl(blobUrl);
          } else if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(blobUrl);
          }
        })
        .catch(() => {});
    }
  }
}

export const editorBootstrapQuery = (
  _queryClient: QueryClient | undefined,
  targetId: string,
  options?: { fileId?: string | null; isProjectRoute?: boolean },
) => {
  const fileId = options?.fileId ?? null;
  const isProjectRoute = Boolean(options?.isProjectRoute);
  return queryOptions({
    queryKey: pageKeys.bootstrap(targetId, fileId, isProjectRoute),
    queryFn: async ({ signal, client }): Promise<EditorBootstrapResponseDto | null> => {
      if (
        !targetId ||
        typeof pagesService.bootstrap?.getEditorBootstrap !== 'function'
      ) {
        return null;
      }

      const promise = (async () => {
        try {
          const data = await pagesService.bootstrap.getEditorBootstrap(targetId, {
            fileId,
            isProjectRoute,
            signal,
          });
          if (data && data.workspace && data.activeDoc) {
            hydrateEditorBootstrap(client, data, targetId);
            return data;
          }
          return null;
        } catch {
          return null;
        }
      })();

      return registerEditorBootstrapPromise([targetId, fileId], promise);
    },
    staleTime: DOCUMENT_QUERY_STALE_TIME,
    gcTime: DOCUMENT_QUERY_GC_TIME,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
