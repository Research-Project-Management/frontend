/**
 * offline-bootstrap.ts
 *
 * Offline IndexedDB Bootstrap Synthesis & File List Fallback Helpers.
 */

import type { EditorBootstrapResponseDto } from '@/features/editor/sdk/pages.service';
import {
  unsyncedEditsStore,
  syncedDocCacheStore,
  type CachedWorkspaceTree,
} from '@/features/editor/domain/offline-storage';
import type { PageFile } from '@/features/editor/domain/types/core.types';

function parseCachedWorkspaceTree(
  raw: CachedWorkspaceTree | null,
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
  entryId: string,
  requestedFileId?: string | null,
): Promise<{ dto: EditorBootstrapResponseDto; markActiveDirty: boolean } | null> {
  if (!entryId) return null;
  const trimmedFileId = requestedFileId?.trim() || null;
  const targetId = trimmedFileId || entryId;

  const [
    treeSnapshotRaw,
    requestedUnsynced,
    requestedCachedDoc,
    rootUnsyncedByEntry,
    rootCachedDocByEntry,
    initialCachedDocs,
  ] = await Promise.all([
    syncedDocCacheStore.getWorkspaceTree(entryId),
    trimmedFileId ? unsyncedEditsStore.get(targetId) : Promise.resolve(null),
    trimmedFileId ? syncedDocCacheStore.get(targetId) : Promise.resolve(null),
    unsyncedEditsStore.get(entryId),
    syncedDocCacheStore.get(entryId),
    syncedDocCacheStore.getByScope(entryId),
  ]);

  const treeSnapshot = parseCachedWorkspaceTree(treeSnapshotRaw);

  let rootDraft = rootUnsyncedByEntry;
  let rootSnap = rootCachedDocByEntry;
  if (treeSnapshot && treeSnapshot.workspace.rootDocId !== entryId) {
    const [resolvedRootDraft, resolvedRootSnap] = await Promise.all([
      unsyncedEditsStore.get(treeSnapshot.workspace.rootDocId),
      syncedDocCacheStore.get(treeSnapshot.workspace.rootDocId),
    ]);
    rootDraft = resolvedRootDraft ?? rootUnsyncedByEntry;
    rootSnap = resolvedRootSnap ?? rootCachedDocByEntry;
  }

  const inferredProjectId =
    treeSnapshot?.workspace.spaceId ||
    rootSnap?.projectId ||
    requestedCachedDoc?.projectId ||
    rootDraft?.projectId ||
    requestedUnsynced?.projectId ||
    '';
  const snapshots =
    initialCachedDocs.length > 0
      ? initialCachedDocs
      : inferredProjectId && inferredProjectId !== entryId
        ? await syncedDocCacheStore.getByScope(inferredProjectId)
        : initialCachedDocs;

  if (
    !treeSnapshot &&
    !requestedUnsynced &&
    !requestedCachedDoc &&
    !rootDraft &&
    !rootSnap &&
    snapshots.length === 0
  ) {
    return null;
  }

  const spaceId = treeSnapshot
    ? treeSnapshot.workspace.spaceId
    : rootSnap?.projectId ||
      requestedCachedDoc?.projectId ||
      rootDraft?.projectId ||
      requestedUnsynced?.projectId ||
      snapshots[0]?.projectId ||
      entryId;
  const rootDocId = treeSnapshot
    ? treeSnapshot.workspace.rootDocId
    : rootSnap?.id || rootDraft?.fileId || snapshots[0]?.id || entryId;
  const pageId = treeSnapshot
    ? treeSnapshot.workspace.pageId
    : entryId !== spaceId
      ? entryId
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
      (requestedUnsynced ||
        requestedCachedDoc ||
        snapshots.some((s) => s.id === trimmedFileId) ||
        Boolean(matchingTreeDocNode)),
  );
  const activeId = hasRequestedMatch && trimmedFileId ? trimmedFileId : rootDocId;
  const fallbackToRoot = Boolean(
    trimmedFileId && !hasRequestedMatch && activeId === rootDocId,
  );

  const activeDraft =
    activeId === targetId && trimmedFileId
      ? requestedUnsynced
      : activeId === rootDocId
        ? rootDraft
        : activeId === entryId
          ? rootUnsyncedByEntry
          : await unsyncedEditsStore.get(activeId);
  const activeSnap =
    snapshots.find((s) => s.id === activeId) ??
    (activeId === targetId && trimmedFileId
      ? requestedCachedDoc
      : activeId === rootDocId
        ? rootSnap
        : activeId === entryId
          ? rootCachedDocByEntry
          : await syncedDocCacheStore.get(activeId));

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

  const mapSnapshotToTreeNode = (
    snap: (typeof snapshots)[number],
    sortOrder: number,
  ): EditorBootstrapResponseDto['tree'][number] => {
    const relPath = (snap.filePath || snap.title || 'main.tex').replace(/^\/+/, '');
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
      sortOrder,
      createdAt: updatedIso,
      updatedAt: updatedIso,
    };
  };

  let tree: EditorBootstrapResponseDto['tree'];
  if (treeSnapshot && treeSnapshot.tree.length > 0) {
    const existingTreeIds = new Set<string>();
    for (const node of treeSnapshot.tree) {
      if (node.id) existingTreeIds.add(node.id);
      if (node.docId) existingTreeIds.add(node.docId);
      if (node.fileId) existingTreeIds.add(node.fileId);
    }
    const extraSnapshotNodes = snapshots
      .filter((snap) => !existingTreeIds.has(snap.id))
      .map((snap, idx) => mapSnapshotToTreeNode(snap, treeSnapshot.tree.length + idx));
    tree = [...treeSnapshot.tree, ...extraSnapshotNodes];
  } else if (snapshots.length > 0) {
    tree = snapshots.map((snap, idx) => mapSnapshotToTreeNode(snap, idx));
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
            role: 'viewer',
            canEdit: false,
            canCompile: false,
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

export async function fetchOfflinePageFilesFallback(pageId: string): Promise<PageFile[]> {
  const [cachedDocs, unsyncedEdits] = await Promise.all([
    syncedDocCacheStore.getByScope(pageId),
    unsyncedEditsStore.getAllByScope(pageId),
  ]);
  const byId = new Map<string, PageFile>();
  for (const s of cachedDocs) {
    byId.set(s.id, {
      id: s.id,
      title: s.filePath || s.title,
      path: s.filePath || s.title,
      content: '',
      pageId,
      projectId: s.projectId,
      updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : undefined,
    });
  }
  for (const edit of unsyncedEdits) {
    if (!byId.has(edit.fileId)) {
      byId.set(edit.fileId, {
        id: edit.fileId,
        title: edit.title || edit.fileId,
        path: edit.title || edit.fileId,
        content: '',
        pageId,
        projectId: edit.projectId,
        updatedAt: edit.savedAt ? new Date(edit.savedAt).toISOString() : undefined,
      });
    }
  }
  return Array.from(byId.values());
}
