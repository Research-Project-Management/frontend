/**
 * tab-close-navigation.ts
 *
 * Offline tab hydration helper and tab-close / adjacent-tab navigation flows
 * extracted from NavigationCoordinator.
 */

import { usePageStore } from '@/features/editor/core/store/editor.store';
import {
  useWorkspaceStore,
  type EditorTab,
} from '@/features/editor/core/store/workspace.store';
import { useConnectivityStore } from '@/features/editor/core/store/connectivity.store';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { syncShallowFileUrlParam } from '@/features/editor/domain/constants/editor.constants';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  unsyncedEditsStore,
  syncedDocCacheStore,
} from '@/features/editor/domain/offline-storage';
import { isProtectedRootTab } from '@/features/editor/domain/workspace/editor-tab-pool.domain';

export interface TabNavigationHost {
  readonly resolveCanonicalTabScope: (pageStore?: ReturnType<typeof usePageStore.getState>) => string;
  readonly openDocument: (options: {
    fileId: string;
    title: string;
    path?: string;
    content?: string;
    line?: number;
    column?: number;
    highlight?: 'error' | 'synctex';
    preview?: boolean;
  }) => void;
}

export function hydrateUnopenedDocumentFromOffline(params: {
  fileId: string;
  title: string;
  path?: string;
  scopeId: string;
}): void {
  const { fileId, title, path: optPath, scopeId } = params;
  void Promise.all([
    unsyncedEditsStore.get(fileId).catch(() => null),
    syncedDocCacheStore.get(fileId).catch(() => null),
  ]).then(([unsyncedEdit, syncedDoc]) => {
    const latestModel = lruDocumentCache.getModel(fileId);
    if (latestModel && latestModel.isAuthoritative !== false) return;

    const manifest = lruDocumentCache.getManifestEntry(fileId);
    const isOnline = useConnectivityStore.getState().checkIsOnline();
    if (
      unsyncedEdit &&
      typeof unsyncedEdit.content === 'string' &&
      (!syncedDoc || unsyncedEdit.savedAt >= syncedDoc.updatedAt) &&
      !(
        isOnline &&
        manifest?.rev !== undefined &&
        unsyncedEdit.expectedRev !== undefined &&
        manifest.rev > unsyncedEdit.expectedRev
      )
    ) {
      lruDocumentCache.registerModel(fileId, {
        content: unsyncedEdit.content,
        filePath: optPath || title || unsyncedEdit.title || syncedDoc?.filePath || fileId,
        projectId: unsyncedEdit.projectId || syncedDoc?.projectId || scopeId,
        serverRev: unsyncedEdit.expectedRev ?? syncedDoc?.rev ?? manifest?.rev,
        hash: syncedDoc?.hash ?? manifest?.hash ?? null,
        isAuthoritative: true,
      });
      lruDocumentCache.markDirty(fileId);
      if (usePageStore.getState().getActiveDocumentId() === fileId) {
        const ps = usePageStore.getState();
        ps.setActiveFilePage({
          id: fileId,
          title,
          path: optPath || title,
          content: unsyncedEdit.content,
          pageId: ps.currentPage?.id || scopeId || fileId,
          spaceId: ps.spaceId,
          projectId: ps.projectId,
        });
      }
      return;
    }

    if (
      syncedDoc &&
      typeof syncedDoc.content === 'string' &&
      (!isOnline || lruDocumentCache.isSyncedCacheFreshAgainstManifest(fileId, syncedDoc))
    ) {
      lruDocumentCache.registerModel(fileId, {
        content: syncedDoc.content,
        filePath: optPath || title || syncedDoc.filePath || fileId,
        projectId: syncedDoc.projectId || scopeId,
        serverRev: syncedDoc.rev ?? manifest?.rev,
        hash: syncedDoc.hash ?? manifest?.hash ?? null,
        isAuthoritative: true,
      });
      if (usePageStore.getState().getActiveDocumentId() === fileId) {
        const ps = usePageStore.getState();
        ps.setActiveFilePage({
          id: fileId,
          title,
          path: optPath || title,
          content: syncedDoc.content,
          pageId: ps.currentPage?.id || scopeId || fileId,
          spaceId: ps.spaceId,
          projectId: ps.projectId,
        });
      }
    }
  });
}

function openOrRestoreTabEntry(
  host: TabNavigationHost,
  nextActiveId: string | undefined,
  scopeId: string,
  pageStore: ReturnType<typeof usePageStore.getState>,
  tabs: readonly EditorTab[],
): void {
  const rootPageId = pageStore.parentPageId || pageStore.currentPage?.id || scopeId;
  const isNextRoot = !nextActiveId || nextActiveId === rootPageId || nextActiveId === `${rootPageId}-main`;
  if (isNextRoot && pageStore.currentPage) {
    pageStore.setActiveFilePage(pageStore.currentPage);
    syncShallowFileUrlParam(undefined);
    return;
  }
  const match = tabs.find((t) => t.id === nextActiveId);
  if (match) {
    host.openDocument({
      fileId: match.id,
      title: match.title,
      path: match.path,
      preview: Boolean(match.isPreview && !match.isPinned),
    });
  }
}

export function executeCloseDocument(host: TabNavigationHost, fileId: string): void {
  const tabsStore = useWorkspaceStore.getState();
  const pageStore = usePageStore.getState();
  const scopeId = host.resolveCanonicalTabScope(pageStore);

  sessionCoordinator.closeTab(fileId);

  tabsStore.closeTab(scopeId, fileId, (nextId) => {
    const rootPageId = pageStore.parentPageId || pageStore.currentPage?.id || scopeId;
    const isNextRoot = !nextId || nextId === rootPageId || nextId === `${rootPageId}-main`;

    if (!isNextRoot && nextId) {
      tabsStore.setActiveTab(scopeId, nextId);
      const tabs = useWorkspaceStore.getState().tabsByProject[scopeId] || [];
      const nextActiveTab = tabs.find((t) => t.id === nextId);
      if (nextActiveTab) {
        host.openDocument({
          fileId: nextActiveTab.id,
          title: nextActiveTab.title,
          path: nextActiveTab.path,
          preview: Boolean(nextActiveTab.isPreview && !nextActiveTab.isPinned),
        });
      }
    } else {
      tabsStore.setActiveTab(scopeId, rootPageId);
      const rootPage = pageStore.currentPage;
      if (rootPage) {
        pageStore.setActiveFilePage(rootPage);
        syncShallowFileUrlParam(undefined);
      }
    }
  });
}

export function executeCloseOtherDocuments(host: TabNavigationHost, keepFileId: string): void {
  const tabsStore = useWorkspaceStore.getState();
  const pageStore = usePageStore.getState();
  const scopeId = host.resolveCanonicalTabScope(pageStore);
  const evicted = tabsStore.closeOtherTabs(scopeId, keepFileId);
  for (const id of evicted) {
    sessionCoordinator.closeTab(id);
  }

  const nextState = useWorkspaceStore.getState();
  const nextActiveId = nextState.activeByProject[scopeId];
  const currentActiveId = pageStore.getActiveDocumentId();
  if (nextActiveId && nextActiveId !== currentActiveId) {
    openOrRestoreTabEntry(host, nextActiveId, scopeId, pageStore, nextState.tabsByProject[scopeId] ?? []);
  }
}

export function executeCloseDocumentsToRight(host: TabNavigationHost, fromFileId: string): void {
  const tabsStore = useWorkspaceStore.getState();
  const pageStore = usePageStore.getState();
  const scopeId = host.resolveCanonicalTabScope(pageStore);
  const closed = tabsStore.closeTabsToRight(scopeId, fromFileId);
  for (const id of closed) {
    sessionCoordinator.closeTab(id);
  }

  const nextState = useWorkspaceStore.getState();
  const nextActiveId = nextState.activeByProject[scopeId];
  const currentActiveId = pageStore.getActiveDocumentId();
  if (nextActiveId && nextActiveId !== currentActiveId) {
    openOrRestoreTabEntry(host, nextActiveId, scopeId, pageStore, nextState.tabsByProject[scopeId] ?? []);
  }
}

export function executeCloseSavedDocuments(host: TabNavigationHost): void {
  const tabsStore = useWorkspaceStore.getState();
  const pageStore = usePageStore.getState();
  const scopeId = host.resolveCanonicalTabScope(pageStore);
  const closed = tabsStore.closeSavedTabs(scopeId);
  for (const id of closed) {
    sessionCoordinator.closeTab(id);
  }

  const nextState = useWorkspaceStore.getState();
  const nextActiveId = nextState.activeByProject[scopeId];
  const currentActiveId = pageStore.getActiveDocumentId();
  const rootPageId = pageStore.parentPageId || pageStore.currentPage?.id || scopeId;
  if (!nextActiveId || nextActiveId === rootPageId || nextActiveId === `${rootPageId}-main`) {
    if (pageStore.currentPage && currentActiveId !== pageStore.currentPage.id) {
      pageStore.setActiveFilePage(pageStore.currentPage);
      syncShallowFileUrlParam(undefined);
    }
  } else if (nextActiveId !== currentActiveId) {
    openOrRestoreTabEntry(host, nextActiveId, scopeId, pageStore, nextState.tabsByProject[scopeId] ?? []);
  }
}

export function executeActivateAdjacentTab(host: TabNavigationHost, delta: 1 | -1): void {
  const tabsStore = useWorkspaceStore.getState();
  const pageStore = usePageStore.getState();
  const scopeId = host.resolveCanonicalTabScope(pageStore);
  const tabs = tabsStore.tabsByProject[scopeId] ?? [];
  if (tabs.length <= 1) return;

  const currentActive = tabsStore.activeByProject[scopeId] || pageStore.getActiveDocumentId();
  const currentIdx = Math.max(0, tabs.findIndex((t) => t.id === currentActive));
  const nextIdx = (currentIdx + delta + tabs.length) % tabs.length;
  const nextTab = tabs[nextIdx];
  if (!nextTab || nextTab.id === currentActive) return;

  host.openDocument({
    fileId: nextTab.id,
    title: nextTab.title,
    path: nextTab.path,
    preview: Boolean(nextTab.isPreview && !nextTab.isPinned),
  });
}

export function executeCloseActiveDocument(host: TabNavigationHost): void {
  const tabsStore = useWorkspaceStore.getState();
  const pageStore = usePageStore.getState();
  const scopeId = host.resolveCanonicalTabScope(pageStore);
  const tabs = tabsStore.tabsByProject[scopeId] ?? [];
  if (tabs.length <= 1) return;

  const activeId = tabsStore.activeByProject[scopeId] || pageStore.getActiveDocumentId();
  if (!activeId) return;

  const activeTab = tabs.find((t) => t.id === activeId);
  if (!activeTab || isProtectedRootTab(activeTab, scopeId)) return;

  executeCloseDocument(host, activeTab.id);
}
