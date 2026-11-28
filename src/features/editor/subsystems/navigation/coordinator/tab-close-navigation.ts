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
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { syncShallowFileUrlParam } from '@/features/editor/domain/constants/editor.constants';
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

function isRootTabId(
  tabId: string | null | undefined,
  rootPageId: string | null | undefined,
): boolean {
  return !tabId || Boolean(rootPageId && (tabId === rootPageId || tabId === `${rootPageId}-main`));
}

function openOrRestoreTabEntry(
  host: TabNavigationHost,
  nextActiveId: string | undefined,
  tabGroupId: string,
  pageStore: ReturnType<typeof usePageStore.getState>,
  tabs: readonly EditorTab[],
): void {
  const rootPageId = pageStore.parentPageId || pageStore.currentPage?.id || tabGroupId;
  if (isRootTabId(nextActiveId, rootPageId) && pageStore.currentPage) {
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
  const tabGroupId = host.resolveCanonicalTabScope(pageStore);

  sessionCoordinator.closeTab(fileId);

  tabsStore.closeTab(tabGroupId, fileId, (nextId) => {
    const rootPageId = pageStore.parentPageId || pageStore.currentPage?.id || tabGroupId;

    if (!isRootTabId(nextId, rootPageId) && nextId) {
      tabsStore.setActiveTab(tabGroupId, nextId);
      const tabs = useWorkspaceStore.getState().tabsByProject[tabGroupId] || [];
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
      tabsStore.setActiveTab(tabGroupId, rootPageId);
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
  const tabGroupId = host.resolveCanonicalTabScope(pageStore);
  const evicted = tabsStore.closeOtherTabs(tabGroupId, keepFileId);
  for (const id of evicted) {
    sessionCoordinator.closeTab(id);
  }

  const nextState = useWorkspaceStore.getState();
  const nextActiveId = nextState.activeByProject[tabGroupId];
  const currentActiveId = pageStore.getActiveDocumentId();
  if (nextActiveId && nextActiveId !== currentActiveId) {
    openOrRestoreTabEntry(host, nextActiveId, tabGroupId, pageStore, nextState.tabsByProject[tabGroupId] ?? []);
  }
}

export function executeCloseDocumentsToRight(host: TabNavigationHost, fromFileId: string): void {
  const tabsStore = useWorkspaceStore.getState();
  const pageStore = usePageStore.getState();
  const tabGroupId = host.resolveCanonicalTabScope(pageStore);
  const closed = tabsStore.closeTabsToRight(tabGroupId, fromFileId);
  for (const id of closed) {
    sessionCoordinator.closeTab(id);
  }

  const nextState = useWorkspaceStore.getState();
  const nextActiveId = nextState.activeByProject[tabGroupId];
  const currentActiveId = pageStore.getActiveDocumentId();
  if (nextActiveId && nextActiveId !== currentActiveId) {
    openOrRestoreTabEntry(host, nextActiveId, tabGroupId, pageStore, nextState.tabsByProject[tabGroupId] ?? []);
  }
}

export function executeCloseSavedDocuments(host: TabNavigationHost): void {
  const tabsStore = useWorkspaceStore.getState();
  const pageStore = usePageStore.getState();
  const tabGroupId = host.resolveCanonicalTabScope(pageStore);
  const closed = tabsStore.closeSavedTabs(tabGroupId);
  for (const id of closed) {
    sessionCoordinator.closeTab(id);
  }

  const nextState = useWorkspaceStore.getState();
  const nextActiveId = nextState.activeByProject[tabGroupId];
  const currentActiveId = pageStore.getActiveDocumentId();
  const rootPageId = pageStore.parentPageId || pageStore.currentPage?.id || tabGroupId;
  if (isRootTabId(nextActiveId, rootPageId)) {
    if (pageStore.currentPage && currentActiveId !== pageStore.currentPage.id) {
      pageStore.setActiveFilePage(pageStore.currentPage);
      syncShallowFileUrlParam(undefined);
    }
  } else if (nextActiveId && nextActiveId !== currentActiveId) {
    openOrRestoreTabEntry(host, nextActiveId, tabGroupId, pageStore, nextState.tabsByProject[tabGroupId] ?? []);
  }
}

export function executeActivateAdjacentTab(host: TabNavigationHost, delta: 1 | -1): void {
  const tabsStore = useWorkspaceStore.getState();
  const pageStore = usePageStore.getState();
  const tabGroupId = host.resolveCanonicalTabScope(pageStore);
  const tabs = tabsStore.tabsByProject[tabGroupId] ?? [];
  if (tabs.length <= 1) return;

  const currentActive = tabsStore.activeByProject[tabGroupId] || pageStore.getActiveDocumentId();
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
  const tabGroupId = host.resolveCanonicalTabScope(pageStore);
  const tabs = tabsStore.tabsByProject[tabGroupId] ?? [];
  if (tabs.length <= 1) return;

  const activeId = tabsStore.activeByProject[tabGroupId] || pageStore.getActiveDocumentId();
  if (!activeId) return;

  const activeTab = tabs.find((t) => t.id === activeId);
  if (!activeTab || isProtectedRootTab(activeTab, tabGroupId)) return;

  executeCloseDocument(host, activeTab.id);
}
