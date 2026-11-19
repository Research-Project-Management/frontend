/**
 * document.queries.ts
 *
 * TanStack Query Keys & Query Options for Editor Document Management.
 * Layer 4: Presentation / Data-Fetching Queries.
 */

import { queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  manuscriptService,
  mapStructureNodesToPageFiles,
  mapStructureNodesToStorageItems,
  type EditorBootstrapResponseDto,
} from '@/features/editor/sdk/pages.service';
import {
  draftStorageService,
  type WorkspaceTreeSnapshot,
} from '@/features/editor/domain/document/draft-storage';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { useConnectivityStore } from '@/features/editor/core/store/connectivity.store';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { workspaceCoordinator } from '@/features/editor/core/coordinator/workspace.coordinator';
import { useCompileStore } from '@/features/editor/subsystems/compiler/coordinator/compiler.store';
import {
  extractProjectId,
  extractDocumentContentString,
  type Page,
  type PageFile,
} from '@/features/editor/domain/types/core.types';

// ── 1. Query Keys ────────────────────────────────────────────────────────────

export const pageKeys = {
  all: ['pages'] as const,
  bootstrap: (scopeId: string, fileId?: string | null, isProjectRoute?: boolean) =>
    isProjectRoute
      ? (['pages', 'bootstrap', 'project', scopeId, fileId || 'root'] as const)
      : (['pages', 'bootstrap', scopeId, fileId || 'root'] as const),
  detail: (pageId: string) => ['pages', 'detail', pageId] as const,
  files: (pageId: string) => ['pages', 'detail', pageId, 'files'] as const,
  deletedFiles: (pageId: string) => ['pages', 'detail', pageId, 'deleted-files'] as const,
};

export const storageKeys = {
  allFiles: ['editor-storage-files'] as const,
  storageAll: (projectId?: string | null) =>
    projectId
      ? (['editor-storage-files', projectId] as const)
      : (['editor-storage-files'] as const),
  files: (projectId?: string | null, pageIdOrProjectId?: string | null, parentId?: string | null) =>
    parentId !== undefined
      ? (['editor-storage-files', projectId, pageIdOrProjectId, parentId] as const)
      : (['editor-storage-files', projectId, pageIdOrProjectId] as const),
  rootDoc: (projectId?: string | null) =>
    projectId ? (['editor-root-doc', projectId] as const) : (['editor-root-doc'] as const),
  projects: ['projects'] as const,
};

export interface InvalidateFileTreeOptions {
  parentPageId?: string | null;
  pageId?: string | null;
  includeDeleted?: boolean;
  includeRootDoc?: boolean;
  includeProjects?: boolean;
}

const DOCUMENT_QUERY_STALE_TIME = 30_000;
const DOCUMENT_PAGE_LOCAL_FIRST_STALE_TIME = Infinity;
const DOCUMENT_QUERY_GC_TIME = 5 * 60_000;
const INVALIDATION_DEDUP_WINDOW_MS = 50;
const recentInvalidationTimestamps = new WeakMap<QueryClient, Map<string, number>>();
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
  scopeId?: string | null,
): Promise<EditorBootstrapResponseDto | null> | null {
  if (!scopeId) return null;
  return inFlightEditorBootstraps.get(scopeId) ?? null;
}

function normalizeBootstrapActivePage(data: EditorBootstrapResponseDto): Page {
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
  } as unknown as Page;
}

/**
 * Single hydration seam distributing a 3-block EditorBootstrap payload into
 * TanStack Query caches, RAM LRU cache, IndexedDB snapshots, symbols index,
 * workspace/page stores, and compiler diagnostics/PDF metadata.
 */
export function hydrateEditorBootstrap(
  queryClient: QueryClient,
  data: EditorBootstrapResponseDto,
  requestedScopeId?: string,
  options?: { offlineFallback?: boolean },
): void {
  const { workspace, tree, activeDoc, symbols, lastBuild, degradedBranches } = data;
  const activePage = normalizeBootstrapActivePage(data);
  const resolvedProjectId = workspace.spaceType === 'project' ? workspace.spaceId : '';
  const effectiveProjectOrSpace = workspace.spaceId;

  if (!options?.offlineFallback && Array.isArray(tree)) {
    lruDocumentCache.hydrateManifestFromTree(tree, {
      rootDocId: workspace.rootDocId,
      pageId: workspace.pageId,
    });
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
    if (requestedScopeId && requestedScopeId === workspace.rootDocId) {
      queryClient.setQueryData(pageKeys.detail(requestedScopeId), activePage);
    }
  }

  const pageFiles = mapStructureNodesToPageFiles(tree, workspace.rootDocId);
  const fileScopeIds = Array.from(
    new Set(
      [workspace.pageId, workspace.rootDocId, requestedScopeId].filter((id): id is string => Boolean(id)),
    ),
  );
  for (const id of fileScopeIds) {
    queryClient.setQueryData(pageKeys.files(id), pageFiles);
  }

  const storageItems = mapStructureNodesToStorageItems(tree, workspace.spaceId);
  const storageKeysToSeed = [
    storageKeys.files(workspace.pageId, workspace.pageId),
    storageKeys.files(workspace.spaceId, workspace.pageId),
    ...(workspace.rootDocId !== workspace.pageId
      ? [storageKeys.files(workspace.rootDocId, workspace.rootDocId)]
      : []),
    ...(requestedScopeId &&
    (requestedScopeId === workspace.pageId ||
      requestedScopeId === workspace.rootDocId)
      ? [storageKeys.files(requestedScopeId, requestedScopeId)]
      : []),
  ];
  for (const key of storageKeysToSeed) {
    queryClient.setQueryData(key, storageItems);
  }
  workspaceCoordinator.syncStructureItems(storageItems, workspace.pageId);

  // 2. Warm RAM LRU Cache + IndexedDB Snapshot for ONLY the active file (never overwrite dirty buffers)
  const filePath = activePage.path || activePage.title || workspace.mainFilePath || 'main.tex';
  if (!lruDocumentCache.isDirty(activePage.id)) {
    const contentText = extractDocumentContentString(activePage.content);
    const serverRev = activePage.rev ?? data.activeDoc.rev ?? data.activeDoc.page?.rev;
    const activeHash =
      activePage.hash ??
      data.activeDoc.hash ??
      data.activeDoc.page?.hash ??
      lruDocumentCache.getManifestEntry(activePage.id)?.hash ??
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
    void draftStorageService.saveProjectFileSnapshot({
      id: activePage.id,
      projectId: workspace.spaceId,
      title: activePage.title || 'main.tex',
      content: contentText,
      filePath,
      ...(typeof serverRev === 'number' ? { rev: serverRev } : {}),
      ...(activeHash !== undefined ? { hash: activeHash } : {}),
      updatedAt: Date.now(),
    });
  }

  void draftStorageService.saveWorkspaceTreeSnapshot(
    [workspace.pageId, workspace.rootDocId, requestedScopeId].filter(
      (id): id is string => Boolean(id && id.trim()),
    ),
    { workspace, tree },
  );

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
  pageStore.setRootDocId(workspace.rootDocId ?? null);

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
      typeof manuscriptService.compiler?.fetchArtifactBlobUrl === 'function'
    ) {
      void manuscriptService.compiler
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

function parseWorkspaceTreeSnapshot(
  raw: WorkspaceTreeSnapshot | null,
): {
  workspace: EditorBootstrapResponseDto['workspace'];
  tree: EditorBootstrapResponseDto['tree'];
} | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.workspace || typeof raw.workspace !== 'object' || !Array.isArray(raw.tree)) {
    return null;
  }
  const ws = raw.workspace as Partial<EditorBootstrapResponseDto['workspace']>;
  if (
    typeof ws.spaceId !== 'string' ||
    !ws.spaceId ||
    typeof ws.pageId !== 'string' ||
    !ws.pageId ||
    typeof ws.rootDocId !== 'string' ||
    !ws.rootDocId
  ) {
    return null;
  }
  return {
    workspace: ws as EditorBootstrapResponseDto['workspace'],
    tree: raw.tree as EditorBootstrapResponseDto['tree'],
  };
}

export async function synthesizeOfflineEditorBootstrap(
  scopeId: string,
  requestedFileId?: string | null,
): Promise<{ dto: EditorBootstrapResponseDto; markActiveDirty: boolean } | null> {
  if (!scopeId) return null;
  const trimmedFileId = requestedFileId?.trim() || null;
  const targetId = trimmedFileId || scopeId;

  const [
    treeSnapshotRaw,
    requestedDraft,
    requestedSnap,
    rootDraftByScope,
    rootSnapByScope,
    initialSnapshots,
  ] = await Promise.all([
    draftStorageService.getWorkspaceTreeSnapshot(scopeId),
    trimmedFileId ? draftStorageService.getDraft(targetId) : Promise.resolve(null),
    trimmedFileId
      ? draftStorageService.getProjectFileSnapshot(targetId)
      : Promise.resolve(null),
    draftStorageService.getDraft(scopeId),
    draftStorageService.getProjectFileSnapshot(scopeId),
    draftStorageService.getProjectFilesSnapshot(scopeId),
  ]);

  const treeSnapshot = parseWorkspaceTreeSnapshot(treeSnapshotRaw);

  let rootDraft = rootDraftByScope;
  let rootSnap = rootSnapByScope;
  if (treeSnapshot && treeSnapshot.workspace.rootDocId !== scopeId) {
    const [resolvedRootDraft, resolvedRootSnap] = await Promise.all([
      draftStorageService.getDraft(treeSnapshot.workspace.rootDocId),
      draftStorageService.getProjectFileSnapshot(treeSnapshot.workspace.rootDocId),
    ]);
    rootDraft = resolvedRootDraft ?? rootDraftByScope;
    rootSnap = resolvedRootSnap ?? rootSnapByScope;
  }

  const inferredProjectId =
    treeSnapshot?.workspace.spaceId ||
    rootSnap?.projectId ||
    requestedSnap?.projectId ||
    rootDraft?.projectId ||
    requestedDraft?.projectId ||
    '';
  const snapshots =
    initialSnapshots.length > 0
      ? initialSnapshots
      : inferredProjectId && inferredProjectId !== scopeId
        ? await draftStorageService.getProjectFilesSnapshot(inferredProjectId)
        : initialSnapshots;

  if (
    !treeSnapshot &&
    !requestedDraft &&
    !requestedSnap &&
    !rootDraft &&
    !rootSnap &&
    snapshots.length === 0
  ) {
    return null;
  }

  const spaceId = treeSnapshot
    ? treeSnapshot.workspace.spaceId
    : rootSnap?.projectId ||
      requestedSnap?.projectId ||
      rootDraft?.projectId ||
      requestedDraft?.projectId ||
      snapshots[0]?.projectId ||
      scopeId;
  const rootDocId = treeSnapshot
    ? treeSnapshot.workspace.rootDocId
    : rootSnap?.id || rootDraft?.fileId || snapshots[0]?.id || scopeId;
  const pageId = treeSnapshot
    ? treeSnapshot.workspace.pageId
    : scopeId !== spaceId
      ? scopeId
      : rootDocId;

  const matchingTreeDocNode =
    trimmedFileId && treeSnapshot
      ? treeSnapshot.tree.find(
          (node) =>
            node.type?.toUpperCase() === 'DOC' &&
            (node.docId === trimmedFileId || node.id === trimmedFileId),
        )
      : undefined;

  const hasRequestedMatch = Boolean(
    trimmedFileId &&
      (requestedDraft ||
        requestedSnap ||
        snapshots.some((s) => s.id === trimmedFileId) ||
        Boolean(matchingTreeDocNode)),
  );
  const activeId = hasRequestedMatch && trimmedFileId ? trimmedFileId : rootDocId;
  const fallbackToRoot = Boolean(
    trimmedFileId && !hasRequestedMatch && activeId === rootDocId,
  );

  const activeDraft =
    activeId === targetId && trimmedFileId
      ? requestedDraft
      : activeId === rootDocId
        ? rootDraft
        : activeId === scopeId
          ? rootDraftByScope
          : await draftStorageService.getDraft(activeId);
  const activeSnap =
    snapshots.find((s) => s.id === activeId) ??
    (activeId === targetId && trimmedFileId
      ? requestedSnap
      : activeId === rootDocId
        ? rootSnap
        : activeId === scopeId
          ? rootSnapByScope
          : await draftStorageService.getProjectFileSnapshot(activeId));

  const rootTreeNode = treeSnapshot?.tree.find(
    (n) => n.docId === rootDocId || n.id === rootDocId || n.isRootDoc,
  );
  const activeTreeNode = treeSnapshot?.tree.find(
    (n) => n.docId === activeId || n.id === activeId,
  );

  const useDraft = Boolean(
    activeDraft && (!activeSnap || activeDraft.savedAt >= activeSnap.updatedAt),
  );
  const contentText = useDraft ? activeDraft!.content : (activeSnap?.content ?? '');
  const activePathRaw =
    activeSnap?.filePath ||
    activeSnap?.title ||
    activeDraft?.title ||
    activeTreeNode?.path ||
    activeTreeNode?.name ||
    treeSnapshot?.workspace.mainFilePath ||
    'main.tex';
  const activePath = activePathRaw.startsWith('/') ? activePathRaw : `/${activePathRaw}`;
  const activeTitle =
    activeSnap?.title ||
    activeDraft?.title ||
    activeTreeNode?.name ||
    treeSnapshot?.workspace.mainFilePath ||
    'main.tex';
  const nowIso = new Date(
    (useDraft ? activeDraft?.savedAt : activeSnap?.updatedAt) || Date.now(),
  ).toISOString();
  const mainFilePath =
    (
      treeSnapshot?.workspace.mainFilePath ||
      rootSnap?.filePath ||
      rootSnap?.title ||
      rootTreeNode?.path ||
      rootTreeNode?.name ||
      snapshots[0]?.filePath ||
      snapshots[0]?.title ||
      'main.tex'
    ).replace(/^\/+/, '') || 'main.tex';
  const workspaceTitle =
    treeSnapshot?.workspace.title ||
    rootSnap?.title ||
    rootDraft?.title ||
    mainFilePath;

  let tree: EditorBootstrapResponseDto['tree'];
  if (treeSnapshot && treeSnapshot.tree.length > 0) {
    const existingTreeIds = new Set<string>();
    for (const node of treeSnapshot.tree) {
      if (node.id) existingTreeIds.add(node.id);
      if (node.docId) existingTreeIds.add(node.docId);
      if (node.fileId) existingTreeIds.add(node.fileId);
    }
    const extraSnapshotNodes: EditorBootstrapResponseDto['tree'] = snapshots
      .filter((snap) => !existingTreeIds.has(snap.id))
      .map((snap, idx) => {
        const relPath = (snap.filePath || snap.title || 'main.tex').replace(
          /^\/+/,
          '',
        );
        const normPath = relPath.startsWith('/') ? relPath : `/${relPath}`;
        const name = relPath.split('/').pop() || snap.title || 'main.tex';
        const updatedIso = new Date(snap.updatedAt || Date.now()).toISOString();
        return {
          id: snap.id,
          projectId: spaceId,
          pageId,
          parentId: null,
          type: 'DOC',
          name,
          path: normPath,
          docId: snap.id,
          fileId: null,
          isRootDoc: snap.id === rootDocId,
          sizeBytes: snap.sizeBytes ?? snap.content.length,
          sortOrder: treeSnapshot.tree.length + idx,
          createdAt: updatedIso,
          updatedAt: updatedIso,
        };
      });
    tree = [...treeSnapshot.tree, ...extraSnapshotNodes];
  } else if (snapshots.length > 0) {
    tree = snapshots.map((snap, idx) => {
      const relPath = (snap.filePath || snap.title || 'main.tex').replace(
        /^\/+/,
        '',
      );
      const normPath = relPath.startsWith('/') ? relPath : `/${relPath}`;
      const name = relPath.split('/').pop() || snap.title || 'main.tex';
      const updatedIso = new Date(snap.updatedAt || Date.now()).toISOString();
      return {
        id: snap.id,
        projectId: spaceId,
        pageId,
        parentId: null,
        type: 'DOC',
        name,
        path: normPath,
        docId: snap.id,
        fileId: null,
        isRootDoc: snap.id === rootDocId,
        sizeBytes: snap.sizeBytes ?? snap.content.length,
        sortOrder: idx,
        createdAt: updatedIso,
        updatedAt: updatedIso,
      };
    });
  } else {
    tree = [
      {
        id: rootDocId,
        projectId: spaceId,
        pageId,
        parentId: null,
        type: 'DOC',
        name: mainFilePath.split('/').pop() || mainFilePath,
        path: mainFilePath.startsWith('/') ? mainFilePath : `/${mainFilePath}`,
        docId: rootDocId,
        fileId: null,
        isRootDoc: true,
        sizeBytes: contentText.length,
        sortOrder: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
  }

  const dto: EditorBootstrapResponseDto = {
    workspace: treeSnapshot
      ? {
          ...treeSnapshot.workspace,
          spaceId,
          pageId,
          rootDocId,
          title: workspaceTitle,
          mainFilePath,
        }
      : {
          spaceId,
          spaceType: 'personal',
          pageId,
          rootDocId,
          projectName: null,
          title: workspaceTitle,
          mainFilePath,
          permissions: {
            role: 'owner',
            canEdit: true,
            canCompile: true,
          },
          githubLink: null,
        },
    tree,
    activeDoc: {
      id: activeId,
      nodeId: activeTreeNode?.id ?? null,
      page: {
        id: activeId,
        title: activeTitle,
        content: contentText,
        path: activePath,
        status: 'published',
        projectId:
          treeSnapshot?.workspace.spaceType === 'personal'
            ? ''
            : (treeSnapshot?.workspace.spaceId ?? spaceId),
        mainFile: { id: rootDocId, title: mainFilePath },
        mainFileId: rootDocId,
        rootPageId: rootDocId,
        version: 1,
        rev: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      lines: contentText ? contentText.split('\n') : [''],
      version: 1,
      rev: 1,
      ranges: {},
      fallbackToRoot,
    },
    symbols: null,
    lastBuild: {
      status: 'uncompiled',
      pdfArtifactUrl: null,
      synctexAvailable: false,
      lastCompiledAt: null,
      diagnostics: [],
    },
    degraded: true,
    degradedBranches: ['symbols', 'lastBuild'],
    serverTimestamp: new Date().toISOString(),
  };

  return { dto, markActiveDirty: useDraft };
}

export const editorBootstrapQuery = (
  _queryClient: QueryClient | undefined,
  scopeId: string,
  options?: { fileId?: string | null; isProjectRoute?: boolean },
) => {
  const fileId = options?.fileId ?? null;
  const isProjectRoute = Boolean(options?.isProjectRoute);
  return queryOptions({
    queryKey: pageKeys.bootstrap(scopeId, fileId, isProjectRoute),
    queryFn: async ({ signal, client }): Promise<EditorBootstrapResponseDto | null> => {
      if (
        !scopeId ||
        typeof manuscriptService.bootstrap?.getEditorBootstrap !== 'function'
      ) {
        return null;
      }

      const promise = (async () => {
        try {
          const data = await manuscriptService.bootstrap.getEditorBootstrap(scopeId, {
            fileId,
            isProjectRoute,
            signal,
          });
          if (data && data.workspace && data.activeDoc) {
            hydrateEditorBootstrap(client, data, scopeId);
            return data;
          }
          return null;
        } catch {
          const offline = await synthesizeOfflineEditorBootstrap(scopeId, fileId);
          if (offline) {
            hydrateEditorBootstrap(client, offline.dto, scopeId, { offlineFallback: true });
            if (offline.markActiveDirty) {
              lruDocumentCache.markDirty(offline.dto.activeDoc.id);
            }
            return offline.dto;
          }
          return null;
        }
      })();

      return registerEditorBootstrapPromise([scopeId, fileId], promise);
    },
    staleTime: DOCUMENT_QUERY_STALE_TIME,
    gcTime: DOCUMENT_QUERY_GC_TIME,
    retry: false,
    refetchOnWindowFocus: false,
  });
};

/**
 * Single authority for invalidating all TanStack Query keys related to the
 * Editor & Manuscript Virtual File Tree (DRY + Hollywood Principle).
 */
export function invalidateFileTreeQueries(
  queryClient: QueryClient,
  options?: InvalidateFileTreeOptions,
): void {
  const {
    parentPageId,
    pageId,
    includeDeleted = true,
    includeRootDoc = false,
    includeProjects = true,
  } = options ?? {};

  const dedupKey = `${parentPageId ?? '*'}|${pageId ?? '*'}|${includeDeleted ? 1 : 0}|${includeRootDoc ? 1 : 0}|${includeProjects ? 1 : 0}`;
  const now = Date.now();
  let clientMap = recentInvalidationTimestamps.get(queryClient);
  if (!clientMap) {
    clientMap = new Map<string, number>();
    recentInvalidationTimestamps.set(queryClient, clientMap);
  }
  const lastInvalidatedAt = clientMap.get(dedupKey);
  if (lastInvalidatedAt !== undefined && now - lastInvalidatedAt < INVALIDATION_DEDUP_WINDOW_MS) {
    return;
  }
  clientMap.set(dedupKey, now);

  queryClient.invalidateQueries({ queryKey: storageKeys.allFiles });

  if (includeProjects) {
    queryClient.invalidateQueries({ queryKey: storageKeys.projects });
  }
  if (includeRootDoc) {
    queryClient.invalidateQueries({ queryKey: storageKeys.rootDoc() });
    queryClient.invalidateQueries({ queryKey: ['pages', 'bootstrap'] });
  }
  if (pageId) {
    queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
    if (includeDeleted) {
      queryClient.invalidateQueries({ queryKey: pageKeys.deletedFiles(pageId) });
    }
  }
  if (parentPageId) {
    queryClient.invalidateQueries({ queryKey: pageKeys.files(parentPageId) });
    if (includeDeleted) {
      queryClient.invalidateQueries({ queryKey: pageKeys.deletedFiles(parentPageId) });
    }
  }
  if (!pageId && !parentPageId) {
    queryClient.invalidateQueries({ queryKey: pageKeys.all });
  }
}

// ── 2. Query Options & Local-First Resolution ─────────────────────────────────

function buildPageFromSnapshotData(params: {
  id: string;
  content: string;
  filePath: string;
  title?: string;
  projectId?: string;
  spaceId?: string;
  rev?: number;
  hash?: string | null;
  updatedAt?: string | number;
}): Page {
  const leafTitle =
    params.title ||
    params.filePath.split('/').pop() ||
    params.filePath ||
    'main.tex';
  const isoUpdated =
    typeof params.updatedAt === 'number'
      ? new Date(params.updatedAt).toISOString()
      : params.updatedAt || new Date().toISOString();
  return {
    id: params.id,
    title: leafTitle,
    path: params.filePath,
    content: params.content,
    projectId: params.projectId || params.spaceId || params.id,
    ...(params.spaceId ? { spaceId: params.spaceId } : {}),
    ...(params.rev !== undefined ? { rev: params.rev } : {}),
    ...(params.hash !== undefined ? { hash: params.hash } : {}),
    updatedAt: isoUpdated,
  } as Page;
}

/**
 * Resolves a document strictly along the Local-First hierarchy:
 * 1. RAM (`lruDocumentCache`, ~0 ms, 0 IDB, 0 HTTP)
 * 2. OfflineDB (`IndexedDB`: `drafts` + `(hash, rev)`-validated `project_files`, ~1-2 ms, 0 HTTP)
 * 3. Server (`GET /docs/:id`, ONLY on true cache miss or `(hash, rev)` mismatch)
 */
export async function resolveDocumentLocalFirst(
  pageId: string,
  options?: { fallbackPath?: string },
): Promise<Page> {
  if (!pageId) throw new Error('Missing pageId');

  const pendingBoot = waitForEditorBootstrap(pageId);
  if (pendingBoot) {
    const boot = await pendingBoot;
    if (boot?.activeDoc?.page?.id === pageId) {
      return normalizeBootstrapActivePage(boot);
    }
  }

  const manifest = lruDocumentCache.getManifestEntry(pageId);

  // Tier 1: Hot RAM LRU Cache
  const ramModel = lruDocumentCache.getModel(pageId);
  if (ramModel && ramModel.isAuthoritative !== false) {
    const hashMismatch = Boolean(
      manifest?.hash && ramModel.hash && manifest.hash !== ramModel.hash,
    );
    const revNewer = Boolean(
      manifest?.rev !== undefined &&
      ramModel.serverRev !== undefined &&
      manifest.rev > ramModel.serverRev,
    );
    if (ramModel.isDirty || !manifest || (!hashMismatch && !revNewer)) {
      return buildPageFromSnapshotData({
        id: pageId,
        content: ramModel.content,
        filePath: ramModel.filePath || options?.fallbackPath || 'main.tex',
        projectId: ramModel.projectId,
        spaceId: ramModel.spaceId,
        rev: ramModel.serverRev,
        hash: ramModel.hash,
        updatedAt: ramModel.serverUpdatedAt,
      });
    }
  }

  // Tier 2: OfflineDB (IndexedDB)
  const [draft, snapshot] = await Promise.all([
    draftStorageService.getDraft(pageId).catch(() => null),
    draftStorageService.getProjectFileSnapshot(pageId).catch(() => null),
  ]);
  const isOnline = useConnectivityStore.getState().checkIsOnline();

  if (
    draft &&
    typeof draft.content === 'string' &&
    (!snapshot || draft.savedAt >= snapshot.updatedAt)
  ) {
    const hasManifestConflict =
      isOnline &&
      manifest?.rev !== undefined &&
      draft.expectedRev !== undefined &&
      manifest.rev > draft.expectedRev;

    if (hasManifestConflict) {
      try {
        const serverPage = await manuscriptService.docs.getById(pageId);
        const remoteText = extractDocumentContentString(serverPage?.content ?? '');
        const resolvedRev = serverPage?.rev ?? manifest.rev;
        const resolvedHash = serverPage?.hash ?? manifest.hash ?? null;
        const resolvedProjectId =
          extractProjectId(serverPage?.projectId) || draft.projectId || snapshot?.projectId;
        const filePath =
          options?.fallbackPath ||
          serverPage?.path ||
          serverPage?.title ||
          snapshot?.filePath ||
          draft.title ||
          'main.tex';

        lruDocumentCache.registerModel(pageId, {
          content: draft.content,
          filePath,
          projectId: resolvedProjectId,
          spaceId: serverPage?.spaceId,
          serverRev: resolvedRev,
          hash: resolvedHash,
          isAuthoritative: true,
        });
        lruDocumentCache.markDirty(pageId);

        if (remoteText !== draft.content) {
          sessionCoordinator.recordOfflineDraftConflict(pageId, draft.content, remoteText, {
            projectId: resolvedProjectId,
            currentRev: resolvedRev,
          });
        }

        return buildPageFromSnapshotData({
          id: pageId,
          content: draft.content,
          filePath,
          title: serverPage?.title || draft.title,
          projectId: resolvedProjectId,
          spaceId: serverPage?.spaceId,
          rev: resolvedRev,
          hash: resolvedHash,
        });
      } catch {
        // Network check failed; still restore recoverable local draft below
      }
    }

    const filePath =
      options?.fallbackPath ||
      snapshot?.filePath ||
      snapshot?.title ||
      draft.title ||
      'main.tex';
    const projectId = draft.projectId || snapshot?.projectId;
    const resolvedRev = draft.expectedRev ?? snapshot?.rev ?? manifest?.rev;
    const resolvedHash = snapshot?.hash ?? manifest?.hash ?? null;

    lruDocumentCache.registerModel(pageId, {
      content: draft.content,
      filePath,
      projectId,
      serverRev: resolvedRev,
      hash: resolvedHash,
      isAuthoritative: true,
    });
    lruDocumentCache.markDirty(pageId);

    return buildPageFromSnapshotData({
      id: pageId,
      content: draft.content,
      filePath,
      title: draft.title || snapshot?.title,
      projectId,
      rev: resolvedRev,
      hash: resolvedHash,
    });
  }

  if (
    snapshot &&
    typeof snapshot.content === 'string' &&
    (!isOnline || lruDocumentCache.isSnapshotFreshAgainstManifest(pageId, snapshot))
  ) {
    const filePath = options?.fallbackPath || snapshot.filePath || snapshot.title || 'main.tex';
    const resolvedRev = snapshot.rev ?? manifest?.rev;
    const resolvedHash = snapshot.hash ?? manifest?.hash ?? null;

    lruDocumentCache.registerModel(pageId, {
      content: snapshot.content,
      filePath,
      projectId: snapshot.projectId,
      serverRev: resolvedRev,
      hash: resolvedHash,
      isAuthoritative: true,
    });

    return buildPageFromSnapshotData({
      id: pageId,
      content: snapshot.content,
      filePath,
      title: snapshot.title,
      projectId: snapshot.projectId,
      rev: resolvedRev,
      hash: resolvedHash,
      updatedAt: snapshot.updatedAt,
    });
  }

  // Tier 3: Server Authoritative Fetch
  try {
    const page = await manuscriptService.docs.getById(pageId);
    if (page?.id) {
      const textContent = extractDocumentContentString(page.content);
      const resolvedProjectId =
        extractProjectId(page.projectId) || page.spaceId || page.id;
      const filePath = page.path || page.title || options?.fallbackPath || 'main.tex';
      const resolvedHash = page.hash ?? manifest?.hash ?? null;
      const resolvedRev = page.rev ?? manifest?.rev;

      if (!lruDocumentCache.isDirty(page.id)) {
        lruDocumentCache.registerModel(page.id, {
          content: textContent,
          filePath,
          projectId: resolvedProjectId,
          ...(page.spaceId ? { spaceId: page.spaceId } : {}),
          ...(typeof resolvedRev === 'number' ? { serverRev: resolvedRev } : {}),
          ...(resolvedHash !== undefined ? { hash: resolvedHash } : {}),
          ...(page.updatedAt ? { serverUpdatedAt: page.updatedAt } : {}),
          isAuthoritative: true,
        });
        if (typeof page.content === 'string' || textContent.length > 0) {
          void draftStorageService.saveProjectFileSnapshot({
            id: page.id,
            projectId: resolvedProjectId,
            title: page.title || 'main.tex',
            content: textContent,
            filePath,
            ...(typeof resolvedRev === 'number' ? { rev: resolvedRev } : {}),
            ...(resolvedHash !== undefined ? { hash: resolvedHash } : {}),
            updatedAt: Date.now(),
          });
        }
      }
    }
    return page;
  } catch (err) {
    if (draft || snapshot) {
      const useDraft = Boolean(draft && (!snapshot || draft.savedAt >= snapshot.updatedAt));
      const content = useDraft ? draft!.content : snapshot!.content;
      const filePath =
        options?.fallbackPath ||
        snapshot?.filePath ||
        snapshot?.title ||
        draft?.title ||
        'main.tex';
      const projectId = snapshot?.projectId || draft?.projectId;
      const resolvedRev = (useDraft ? draft?.expectedRev : snapshot?.rev) ?? manifest?.rev;
      const resolvedHash = snapshot?.hash ?? manifest?.hash ?? null;

      lruDocumentCache.registerModel(pageId, {
        content,
        filePath,
        projectId,
        serverRev: resolvedRev,
        hash: resolvedHash,
        isAuthoritative: true,
      });
      if (useDraft) {
        lruDocumentCache.markDirty(pageId);
      }

      return buildPageFromSnapshotData({
        id: pageId,
        content,
        filePath,
        title: snapshot?.title || draft?.title,
        projectId,
        rev: resolvedRev,
        hash: resolvedHash,
      });
    }
    throw err;
  }
}

export const pageQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.detail(pageId),
    queryFn: async () => resolveDocumentLocalFirst(pageId),
    staleTime: DOCUMENT_PAGE_LOCAL_FIRST_STALE_TIME,
    gcTime: DOCUMENT_QUERY_GC_TIME,
  });

export const filesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.files(pageId),
    queryFn: async () => {
      if (!pageId) return [];
      const pendingBoot = waitForEditorBootstrap(pageId);
      if (pendingBoot) {
        const boot = await pendingBoot;
        if (boot?.tree) {
          return mapStructureNodesToPageFiles(boot.tree, boot.workspace.rootDocId);
        }
      }
      const files = await manuscriptService.docs.getFiles(pageId);
      if (files.length > 0) return files;

      const isOffline =
        !useConnectivityStore.getState().isOnline ||
        (typeof navigator !== 'undefined' && navigator.onLine === false);
      if (isOffline) {
        const snapshots = await draftStorageService.getProjectFilesSnapshot(pageId);
        if (snapshots.length > 0) {
          return snapshots.map(
            (s): PageFile => ({
              id: s.id,
              title: s.filePath || s.title,
              path: s.filePath || s.title,
              content: '',
              pageId,
              projectId: s.projectId,
              updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : undefined,
            }),
          );
        }
      }
      return files;
    },
    staleTime: DOCUMENT_QUERY_STALE_TIME,
    gcTime: DOCUMENT_QUERY_GC_TIME,
  });

export const deletedFilesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.deletedFiles(pageId),
    queryFn: async () => {
      if (!pageId) return [];
      return await manuscriptService.docs.getDeletedFiles(pageId);
    },
    staleTime: DOCUMENT_QUERY_STALE_TIME,
    gcTime: DOCUMENT_QUERY_GC_TIME,
  });

