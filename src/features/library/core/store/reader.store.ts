import { create } from 'zustand';
import { DEFAULT_ANNOTATION_COLOR } from '@/features/library/domain/reader/reader';
import { multiTabBus } from '@/shared/lib/multi-tab';
import {
  loadReaderStorageState,
  saveReaderTabsToStorage,
  READER_TABS_STORAGE_KEY,
} from '../adapters/project-context.adapter';
import {
  normalizeReaderZoom,
  normalizeReaderTab,
  resolveNextActiveTabOnClose,
  enforceMaxReaderTabs,
  MAX_READER_TABS,
} from '@/features/library/domain/reader/tab-pool';
import type { ReaderFitMode, ReaderTab, ReaderTheme } from '@/features/library/types/reader.types';

export {
  normalizeReaderZoom,
  MAX_READER_TABS,
};
export type { ReaderFitMode, ReaderTab, ReaderTheme };

export type ReaderAnnotationTool =
  | 'select'
  | 'highlight'
  | 'underline'
  | 'note'
  | 'text'
  | 'area'
  | 'ink'
  | 'eraser';

export interface PendingCitationNav {
  paperId: string;
  pageNumber: number;
  timestamp: number;
}

interface ReaderStoreState {
  tabs: ReaderTab[];
  activeTabId: string;
  readingPaperId: string | null;
  activeColor: string;
  activeTool: ReaderAnnotationTool;
  pendingCitationNav: PendingCitationNav | null;
  openReader: (paperId: string, title?: string, projectId?: string | null) => void;
  closeReader: (paperId?: string) => void;
  openTab: (tab: ReaderTab) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (keepId: string) => void;
  reorderTabs: (newTabs: ReaderTab[]) => void;
  setActiveTab: (id: string) => void;
  setActiveColor: (color: string) => void;
  setActiveTool: (tool: ReaderAnnotationTool) => void;
  requestCitationNavigate: (paperId: string, pageNumber: number) => void;
  clearCitationNavigate: () => void;
  updateTabState: (
    paperId: string,
    patch: Partial<
      Pick<
        ReaderTab,
        | 'currentPage'
        | 'scrollTop'
        | 'zoom'
        | 'fitMode'
        | 'rotation'
        | 'theme'
        | 'title'
        | 'viewMode'
        | 'splitMode'
        | 'secondaryPage'
        | 'interactionMode'
        | 'attachmentId'
        | 'fileUrl'
        | 'projectId'
      >
    >,
  ) => void;
}

const initial = loadReaderStorageState();

export const useReaderStore = create<ReaderStoreState>((set, get) => ({
  tabs: initial.tabs,
  activeTabId: initial.activeTabId,
  readingPaperId: initial.activeTabId !== 'library' ? initial.activeTabId : null,
  activeColor: DEFAULT_ANNOTATION_COLOR,
  activeTool: 'select',
  pendingCitationNav: null,

  openReader: (paperId: string, title?: string, projectId?: string | null) => {
    const { tabs, activeTabId, readingPaperId } = get();
    const existing = tabs.find((t) => t.id === paperId);
    let nextTabs = tabs;
    if (!existing) {
      nextTabs = enforceMaxReaderTabs(
        [
          ...tabs,
          normalizeReaderTab({
            id: paperId,
            title: title || 'Loading...',
            type: 'paper',
            currentPage: 1,
            zoom: 1.0,
            fitMode: 'fit-width',
            rotation: 0,
            theme: 'normal',
            ...(projectId !== undefined ? { projectId } : {}),
          }),
        ],
        paperId,
      );
    } else if (
      (title && existing.title !== title) ||
      (projectId !== undefined && existing.projectId !== projectId)
    ) {
      nextTabs = tabs.map((t) =>
        t.id === paperId
          ? {
              ...t,
              ...(title ? { title } : {}),
              ...(projectId !== undefined ? { projectId } : {}),
            }
          : t,
      );
    }

    if (nextTabs === tabs && activeTabId === paperId && readingPaperId === paperId) {
      return;
    }

    const mergedTabs = saveReaderTabsToStorage(nextTabs, paperId);
    multiTabBus.publish({ type: 'READER_TABS_SYNC' });
    set({
      tabs: mergedTabs,
      activeTabId: paperId,
      readingPaperId: paperId,
    });
  },

  closeReader: (paperId?: string) => {
    const { tabs, activeTabId } = get();
    const targetId = paperId || (activeTabId !== 'library' ? activeTabId : null);
    if (!targetId || targetId === 'library') return;

    const nextTabs = tabs.filter((t) => t.id !== targetId);
    const nextActive = resolveNextActiveTabOnClose(tabs, targetId, activeTabId);
    const mergedTabs = saveReaderTabsToStorage(nextTabs, nextActive, undefined, {
      removedIds: [targetId],
    });
    multiTabBus.publish({ type: 'READER_TABS_SYNC' });
    set({
      tabs: mergedTabs,
      activeTabId: nextActive,
      readingPaperId: nextActive !== 'library' ? nextActive : null,
    });
  },

  openTab: (tab: ReaderTab) => {
    const { tabs } = get();
    const normalized = normalizeReaderTab(tab);
    const exists = tabs.some((t) => t.id === normalized.id);
    const nextTabs = exists
      ? tabs.map((t) =>
          t.id === normalized.id
            ? {
                ...t,
                title: normalized.title || t.title,
                currentPage:
                  tab.currentPage !== undefined ? normalized.currentPage : t.currentPage,
                zoom: tab.zoom !== undefined ? normalized.zoom : t.zoom,
                fitMode: tab.fitMode !== undefined ? normalized.fitMode : t.fitMode,
                rotation: tab.rotation !== undefined ? normalized.rotation : t.rotation,
                theme: tab.theme !== undefined ? normalized.theme : t.theme,
                ...(tab.projectId !== undefined ? { projectId: normalized.projectId } : {}),
              }
            : t,
        )
      : enforceMaxReaderTabs([...tabs, normalized], normalized.id);
    const mergedTabs = saveReaderTabsToStorage(nextTabs, normalized.id);
    multiTabBus.publish({ type: 'READER_TABS_SYNC' });
    set({
      tabs: mergedTabs,
      activeTabId: normalized.id,
      readingPaperId: normalized.id !== 'library' ? normalized.id : null,
    });
  },

  closeTab: (id: string) => {
    if (id === 'library') return;
    const { tabs, activeTabId } = get();
    const nextTabs = tabs.filter((t) => t.id !== id);
    const nextActive = resolveNextActiveTabOnClose(tabs, id, activeTabId);
    const mergedTabs = saveReaderTabsToStorage(nextTabs, nextActive, undefined, {
      removedIds: [id],
    });
    multiTabBus.publish({ type: 'READER_TABS_SYNC' });
    set({
      tabs: mergedTabs,
      activeTabId: nextActive,
      readingPaperId: nextActive !== 'library' ? nextActive : null,
    });
  },

  closeOtherTabs: (keepId: string) => {
    const { tabs } = get();
    if (keepId === 'library') {
      const removedIds = tabs
        .filter((t) => t.id !== 'library' && t.type !== 'library')
        .map((t) => t.id);
      if (removedIds.length === 0) return;
      const nextTabs = tabs.filter((t) => t.id === 'library' || t.type === 'library');
      const mergedTabs = saveReaderTabsToStorage(nextTabs, 'library', undefined, {
        removedIds,
      });
      multiTabBus.publish({ type: 'READER_TABS_SYNC' });
      set({
        tabs: mergedTabs,
        activeTabId: 'library',
        readingPaperId: null,
      });
    } else {
      const removedIds = tabs
        .filter((t) => t.id !== keepId && t.id !== 'library' && t.type !== 'library')
        .map((t) => t.id);
      if (removedIds.length === 0) return;
      const nextTabs = tabs.filter(
        (t) => t.id === keepId || t.id === 'library' || t.type === 'library',
      );
      const mergedTabs = saveReaderTabsToStorage(nextTabs, keepId, undefined, {
        removedIds,
      });
      multiTabBus.publish({ type: 'READER_TABS_SYNC' });
      set({
        tabs: mergedTabs,
        activeTabId: keepId,
        readingPaperId: keepId,
      });
    }
  },

  reorderTabs: (newTabs: ReaderTab[]) => {
    const { activeTabId } = get();
    const mergedTabs = saveReaderTabsToStorage(newTabs, activeTabId, undefined, {
      replaceOrder: true,
    });
    multiTabBus.publish({ type: 'READER_TABS_SYNC' });
    set({ tabs: mergedTabs });
  },

  setActiveTab: (id: string) => {
    const { tabs, activeTabId } = get();
    if (activeTabId === id || !tabs.some((t) => t.id === id)) return;
    const mergedTabs = saveReaderTabsToStorage(tabs, id);
    set({
      tabs: mergedTabs,
      activeTabId: id,
      readingPaperId: id !== 'library' ? id : null,
    });
  },

  setActiveColor: (color: string) =>
    set((s) => (s.activeColor === color ? s : { activeColor: color })),

  setActiveTool: (tool: ReaderAnnotationTool) =>
    set((s) => (s.activeTool === tool ? s : { activeTool: tool })),

  updateTabState: (paperId, patch) => {
    const { tabs, activeTabId } = get();
    let changed = false;
    const nextTabs = tabs.map((t) => {
      if (t.id !== paperId) return t;
      const nextTab: ReaderTab = {
        ...t,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.currentPage !== undefined
          ? { currentPage: Math.max(1, Math.floor(patch.currentPage)) }
          : {}),
        ...(patch.scrollTop !== undefined
          ? { scrollTop: Math.max(0, Math.round(patch.scrollTop)) }
          : {}),
        ...(patch.zoom !== undefined ? { zoom: normalizeReaderZoom(patch.zoom) } : {}),
        ...(patch.fitMode !== undefined ? { fitMode: patch.fitMode } : {}),
        ...(patch.rotation !== undefined
          ? { rotation: (((patch.rotation % 360) + 360) % 360) }
          : {}),
        ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
        ...(patch.viewMode !== undefined ? { viewMode: patch.viewMode } : {}),
        ...(patch.splitMode !== undefined ? { splitMode: patch.splitMode } : {}),
        ...(patch.secondaryPage !== undefined
          ? { secondaryPage: Math.max(1, Math.floor(patch.secondaryPage)) }
          : {}),
        ...(patch.interactionMode !== undefined ? { interactionMode: patch.interactionMode } : {}),
        ...(patch.attachmentId !== undefined ? { attachmentId: patch.attachmentId } : {}),
        ...(patch.fileUrl !== undefined ? { fileUrl: patch.fileUrl } : {}),
        ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
      };
      if (
        nextTab.title !== t.title ||
        nextTab.currentPage !== t.currentPage ||
        nextTab.scrollTop !== t.scrollTop ||
        nextTab.zoom !== t.zoom ||
        nextTab.fitMode !== t.fitMode ||
        nextTab.rotation !== t.rotation ||
        nextTab.theme !== t.theme ||
        nextTab.viewMode !== t.viewMode ||
        nextTab.splitMode !== t.splitMode ||
        nextTab.secondaryPage !== t.secondaryPage ||
        nextTab.interactionMode !== t.interactionMode ||
        nextTab.attachmentId !== t.attachmentId ||
        nextTab.fileUrl !== t.fileUrl ||
        nextTab.projectId !== t.projectId
      ) {
        changed = true;
        return nextTab;
      }
      return t;
    });

    if (!changed) return;
    const mergedTabs = saveReaderTabsToStorage(nextTabs, activeTabId);
    multiTabBus.publish({ type: 'READER_TABS_SYNC' });
    set({ tabs: mergedTabs });
  },

  requestCitationNavigate: (paperId: string, pageNumber: number) => {
    const cleanId = paperId.trim();
    if (!cleanId || cleanId === 'library') return;
    if (!Number.isFinite(pageNumber) || pageNumber < 1) return;
    set({
      pendingCitationNav: {
        paperId: cleanId,
        pageNumber: Math.max(1, Math.floor(pageNumber)),
        timestamp: Date.now(),
      },
    });
  },

  clearCitationNavigate: () => {
    if (get().pendingCitationNav !== null) {
      set({ pendingCitationNav: null });
    }
  },
}));

// ── Cross-Tab Store Synchronization (BroadcastChannel + StorageEvent) ────────

export function rehydrateReaderStoreFromStorage(): void {
  const latest = loadReaderStorageState();
  const current = useReaderStore.getState();

  // Preserve current window's activeTabId if it still exists in the synced tab list
  const keepCurrentActive = current.tabs.some((t) => t.id === current.activeTabId) &&
    latest.tabs.some((t) => t.id === current.activeTabId);
  const nextActiveId = keepCurrentActive ? current.activeTabId : latest.activeTabId;

  useReaderStore.setState({
    tabs: latest.tabs,
    activeTabId: nextActiveId,
    readingPaperId: nextActiveId !== 'library' ? nextActiveId : null,
  });
}

if (typeof window !== 'undefined') {
  multiTabBus.subscribe((event) => {
    if (event.type === 'READER_TABS_SYNC') {
      rehydrateReaderStoreFromStorage();
    }
  });

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === READER_TABS_STORAGE_KEY) {
      rehydrateReaderStoreFromStorage();
    }
  });
}
