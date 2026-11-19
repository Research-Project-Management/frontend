import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { historyField, undo } from '@codemirror/commands';
import {
  calculateAdaptiveEditorTabPoolCapacity,
  LruEditorTabPool,
  warmEditorStatePool,
  enforceMaxEditorTabs,
  computeEditorTabDisplayLabels,
  MAX_EDITOR_TABS,
  MAX_PERSISTED_EDITOR_PAGES,
} from '@/features/editor/domain/workspace/editor-tab-pool.domain';
import {
  EDITOR_LIMITS,
  EDITOR_STORAGE_KEYS,
} from '@/features/editor/domain/constants/editor.constants';
import {
  setEditorTabsStorageProvider,
  setEditorWindowStorageProvider,
  mergeEditorTabsWithStorage,
  saveEditorTabsForPage,
  loadEditorTabsForPage,
  flushPendingEditorTabSaves,
  type StorageLike,
} from '@/features/editor/core/store/editor-tabs-storage.adapter';
import {
  useWorkspaceStore,
  rehydrateEditorPageFromStorage,
  usePageStore,
  useSettingsStore,
  sessionCoordinator,
  lruDocumentCache,
} from '@/features/editor/core';
import type { WorkspaceTab } from '@/features/editor/domain/types/workspace.types';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import { draftStorageService } from '@/features/editor/domain/document/draft-storage';
import { buildEditorState } from '@/features/editor/ui/editor/CodeMirrorView';
import { YjsCodeMirrorAdapter } from '@/features/editor/core/engine/collaboration/yjs-codemirror-adapter';
import { EditorTabs } from '@/features/editor/ui/editor/EditorTabs';

function createMemoryStorage(): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

describe('Editor Tab Pool, Multi-Window Sync & CM6 Warm State Governance', () => {
  let sharedLocalStorage: ReturnType<typeof createMemoryStorage>;
  let windowSessionStorage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    sharedLocalStorage = createMemoryStorage();
    windowSessionStorage = createMemoryStorage();
    setEditorTabsStorageProvider(sharedLocalStorage);
    setEditorWindowStorageProvider(windowSessionStorage);

    lruDocumentCache.clear();
    warmEditorStatePool.clear();
    sessionCoordinator.resetSession();

    useWorkspaceStore.setState({
      tabsByProject: {},
      activeByProject: {},
      secondaryActiveByProject: {},
      editorSplitMode: 'none',
      secondaryFileId: null,
      activeEditorPane: 'primary',
    });

    usePageStore.setState({
      spaceId: '',
      projectId: '',
      rootPageId: '',
      parentPageId: '',
      currentPage: null,
      activeFilePage: null,
      activePageId: null,
    });

    useSettingsStore.setState({ previewEditorTabs: true, mainFile: 'main.tex' });
  });

  afterEach(() => {
    setEditorTabsStorageProvider(null);
    setEditorWindowStorageProvider(null);
    vi.restoreAllMocks();
    lruDocumentCache.clear();
    warmEditorStatePool.clear();
    sessionCoordinator.resetSession();
  });

  describe('1. Hardware-Adaptive Warm Standby Pool & LRU Eviction', () => {
    it('sizes warm tab capacity strictly along 3 / 5 / 8 curve by device RAM', () => {
      expect(calculateAdaptiveEditorTabPoolCapacity(1)).toBe(3);
      expect(calculateAdaptiveEditorTabPoolCapacity(2)).toBe(3);
      expect(calculateAdaptiveEditorTabPoolCapacity(4)).toBe(5);
      expect(calculateAdaptiveEditorTabPoolCapacity(undefined)).toBe(5);
      expect(calculateAdaptiveEditorTabPoolCapacity(8)).toBe(8);
      expect(calculateAdaptiveEditorTabPoolCapacity(16)).toBe(8);
    });

    it('promotes accessed keys to MRU head and skips protected keys on tail eviction', () => {
      const pool = new LruEditorTabPool<string>(3);
      pool.put('root-doc', 'state-root');
      pool.put('tab-a', 'state-a');
      pool.put('tab-b', 'state-b');
      expect(pool.getKeysMruOrder()).toEqual(['tab-b', 'tab-a', 'root-doc']);

      // Touching tab-a moves it to MRU head
      expect(pool.get('tab-a')).toBe('state-a');
      expect(pool.getKeysMruOrder()).toEqual(['tab-a', 'tab-b', 'root-doc']);

      // Inserting tab-c with root-doc protected skips root-doc at tail and evicts tab-b
      const evicted = pool.put('tab-c', 'state-c', new Set(['root-doc']));
      expect(evicted).toBe('tab-b');
      expect(pool.has('root-doc')).toBe(true);
      expect(pool.has('tab-b')).toBe(false);
      expect(pool.getKeysMruOrder()).toEqual(['tab-c', 'tab-a', 'root-doc']);
    });
  });

  describe('2. Hard Ceiling MAX_EDITOR_TABS (15) & Zero Data Loss Protection', () => {
    it('evicts unpinned preview tabs first, then LRU clean tabs, never exceeding MAX_EDITOR_TABS', () => {
      const now = 1_000_000;
      const tabs: WorkspaceTab[] = [
        { id: 'page-1', title: 'main.tex', isRoot: true, isPinned: true, lastAccessedAt: now },
        { id: 'preview-old', title: 'preview.tex', isPreview: true, isPinned: false, lastAccessedAt: now + 999 },
      ];
      for (let i = 1; i <= MAX_EDITOR_TABS; i++) {
        tabs.push({
          id: `doc-${i}`,
          title: `sec-${i}.tex`,
          isPinned: true,
          isPreview: false,
          lastAccessedAt: now + i * 10,
        });
      }

      const kept = enforceMaxEditorTabs(tabs, {
        maxTabs: MAX_EDITOR_TABS,
        rootPageId: 'page-1',
        activeTabId: 'doc-15',
        secondaryTabId: 'doc-1',
        isDirtyFn: (id) => id === 'doc-2',
      });

      expect(kept).toHaveLength(MAX_EDITOR_TABS);
      expect(kept.some((t) => t.id === 'page-1')).toBe(true);
      expect(kept.some((t) => t.id === 'doc-1')).toBe(true); // secondary pane protected
      expect(kept.some((t) => t.id === 'doc-2')).toBe(true); // dirty protected
      expect(kept.some((t) => t.id === 'doc-15')).toBe(true); // active protected
      // Even though preview-old had newest timestamp, unpinned preview is evicted first
      expect(kept.some((t) => t.id === 'preview-old')).toBe(false);
    });

    it('never drops dirty unsaved tabs even when more than 15 dirty tabs are open (Zero Data Loss)', () => {
      const dirtyTabs: WorkspaceTab[] = Array.from({ length: 18 }, (_, idx) => ({
        id: `dirty-${idx}`,
        title: `dirty-${idx}.tex`,
        isPinned: true,
        isDirty: true,
        lastAccessedAt: idx,
      }));

      const kept = enforceMaxEditorTabs(dirtyTabs, {
        maxTabs: MAX_EDITOR_TABS,
        isDirtyFn: () => true,
      });

      expect(kept).toHaveLength(18);
    });
  });

  describe('3. Same-Filename Disambiguation & Strict Canonical ID Matching', () => {
    it('keeps duplicate-filename tabs open without overwriting stored titles and computes parent disambiguators', () => {
      usePageStore.setState({ parentPageId: 'page-1', spaceId: 'space-1', projectId: 'space-1' });

      navigationCoordinator.openDocument({
        fileId: 'doc-a',
        title: 'chapters/intro/result.tex',
        path: 'chapters/intro/result.tex',
        content: 'Intro results',
      });
      navigationCoordinator.openDocument({
        fileId: 'doc-b',
        title: 'chapters/discussion/result.tex',
        path: 'chapters/discussion/result.tex',
        content: 'Discussion results',
      });
      navigationCoordinator.openDocument({
        fileId: 'doc-c',
        title: 'appendix/glossary.tex',
        path: 'appendix/glossary.tex',
        content: 'Glossary',
      });

      const storedTabs = useWorkspaceStore.getState().tabsByProject['page-1'] ?? [];
      expect(storedTabs).toHaveLength(3);
      // Preserves stored tab.title without mutation (tier2 parity)
      expect(storedTabs.find((t) => t.id === 'doc-a')?.title).toBe('chapters/intro/result.tex');
      expect(storedTabs.find((t) => t.id === 'doc-b')?.title).toBe('chapters/discussion/result.tex');

      const labels = computeEditorTabDisplayLabels(storedTabs);
      expect(labels.get('doc-a')).toEqual({
        leafTitle: 'result.tex',
        disambiguationDir: 'chapters/intro',
        fullPath: 'chapters/intro/result.tex',
      });
      expect(labels.get('doc-b')).toEqual({
        leafTitle: 'result.tex',
        disambiguationDir: 'chapters/discussion',
        fullPath: 'chapters/discussion/result.tex',
      });
      expect(labels.get('doc-c')).toEqual({
        leafTitle: 'glossary.tex',
        disambiguationDir: null,
        fullPath: 'appendix/glossary.tex',
      });
    });
  });

  describe('4. Preview vs Pinned Tab Lifecycle & Selective Closing', () => {
    it('replaces clean preview tab in-place, protects dirty preview tab, and promotes on pin/edit/reorder', () => {
      const store = useWorkspaceStore.getState();
      store.openTab('page-1', { id: 'page-1', title: 'main.tex', isRoot: true, isPinned: true });

      // Single-click preview #1
      store.openTab('page-1', {
        id: 'sec-1',
        title: 'sec-1.tex',
        isPreview: true,
        isPinned: false,
      });
      expect(useWorkspaceStore.getState().tabsByProject['page-1']?.map((t) => t.id)).toEqual([
        'page-1',
        'sec-1',
      ]);

      // Single-click preview #2 replaces clean preview #1 in-place
      store.openTab('page-1', {
        id: 'sec-2',
        title: 'sec-2.tex',
        isPreview: true,
        isPinned: false,
      });
      expect(useWorkspaceStore.getState().tabsByProject['page-1']?.map((t) => t.id)).toEqual([
        'page-1',
        'sec-2',
      ]);

      // Local edit auto-pins via pinTabForFile and marks model dirty -> next preview won't replace it
      lruDocumentCache.registerModel('sec-2', { content: 'abc' });
      lruDocumentCache.updateContent('sec-2', 'abcdef', true);
      useWorkspaceStore.getState().pinTabForFile('sec-2');

      const pinnedSec2 = useWorkspaceStore
        .getState()
        .tabsByProject['page-1']?.find((t) => t.id === 'sec-2');
      expect(pinnedSec2?.isPinned).toBe(true);
      expect(pinnedSec2?.isPreview).toBe(false);

      // Clean preview #3 appended separately
      store.openTab('page-1', {
        id: 'sec-3',
        title: 'sec-3.tex',
        isPreview: true,
        isPinned: false,
      });
      expect(useWorkspaceStore.getState().tabsByProject['page-1']?.map((t) => t.id)).toEqual([
        'page-1',
        'sec-2',
        'sec-3',
      ]);

      // Reordering auto-pins sec-3 and keeps root tab pinned first
      store.reorderTabs('page-1', ['sec-3', 'page-1', 'sec-2']);
      const afterReorder = useWorkspaceStore.getState().tabsByProject['page-1'] ?? [];
      expect(afterReorder.map((t) => t.id)).toEqual(['page-1', 'sec-3', 'sec-2']);
      expect(afterReorder.find((t) => t.id === 'sec-3')?.isPinned).toBe(true);
      expect(afterReorder.find((t) => t.id === 'sec-3')?.isPreview).toBe(false);

      // closeSavedTabs closes clean sec-3 while protecting root (page-1) and dirty (sec-2)
      const closed = useWorkspaceStore.getState().closeSavedTabs('page-1');
      expect(closed).toEqual(['sec-3']);
      expect(useWorkspaceStore.getState().tabsByProject['page-1']?.map((t) => t.id)).toEqual([
        'page-1',
        'sec-2',
      ]);
    });
  });

  describe('5. Canonical pageId Scoping, Multi-Window RMW Merge & F5 Persistence', () => {
    it('writes tabs strictly under canonical pageId instead of spaceId', () => {
      usePageStore.setState({
        spaceId: 'space-shared',
        projectId: 'space-shared',
        parentPageId: 'page-canonical',
        currentPage: { id: 'page-canonical', title: 'main.tex', status: 'draft' } as never,
      });

      navigationCoordinator.openDocument({
        fileId: 'doc-child',
        title: 'intro.tex',
        content: '\\section{Intro}',
      });

      const state = useWorkspaceStore.getState();
      expect(state.tabsByProject['page-canonical']?.map((t) => t.id)).toContain('doc-child');
      expect(state.tabsByProject['space-shared']).toBeUndefined();
    });

    it('merges open tabs from sibling windows via RMW without clobbering or hijacking local activeTabId', () => {
      // Window B writes tab-b into shared localStorage
      saveEditorTabsForPage(
        'page-1',
        [
          { id: 'page-1', title: 'main.tex', isRoot: true, isPinned: true },
          { id: 'tab-b', title: 'sibling.tex', isPinned: true },
        ],
        'tab-b',
      );

      // Window A (with its own sessionStorage) hydrates and selects main.tex locally
      useWorkspaceStore.getState().hydratePageTabs('page-1', {
        rootDocId: 'page-1',
        rootTitle: 'main.tex',
      });
      useWorkspaceStore.getState().setActiveTab('page-1', 'page-1');

      // Direct RMW merge check: saving Window A's tab list without replaceOrder preserves tab-b opened in Window B
      const merged = mergeEditorTabsWithStorage(
        'page-1',
        [
          { id: 'page-1', title: 'main.tex', isRoot: true, isPinned: true },
          { id: 'tab-a', title: 'local.tex', isPinned: true },
        ],
        { rootPageId: 'page-1' },
      );
      expect(merged.map((t) => t.id)).toEqual(['page-1', 'tab-a', 'tab-b']);

      // Simulate sibling broadcast while Window A has 'page-1' active
      saveEditorTabsForPage('page-1', merged, 'tab-b');
      rehydrateEditorPageFromStorage('page-1');

      const wsState = useWorkspaceStore.getState();
      expect(wsState.tabsByProject['page-1']?.map((t) => t.id)).toEqual(['page-1', 'tab-a', 'tab-b']);
      // Window A keeps its own active tab instead of jumping to Window B's 'tab-b'
      expect(wsState.activeByProject['page-1']).toBe('page-1');
    });

    it('isolates split state per window in sessionStorage, restores on F5, and prunes persisted pages at 30', () => {
      const windowASession = createMemoryStorage();
      const windowBSession = createMemoryStorage();

      saveEditorTabsForPage(
        'page-reload',
        [
          { id: 'page-reload', title: 'main.tex', isRoot: true, isPinned: true },
          { id: 'doc-1', title: 'ch1.tex', isPinned: true },
          { id: 'doc-2', title: 'ch2.tex', isPinned: true },
        ],
        'doc-1',
        {
          storage: sharedLocalStorage,
          sessionStorage: windowASession,
          splitMode: 'vertical',
          secondaryTabId: 'doc-2',
        },
      );

      saveEditorTabsForPage(
        'page-reload',
        [
          { id: 'page-reload', title: 'main.tex', isRoot: true, isPinned: true },
          { id: 'doc-1', title: 'ch1.tex', isPinned: true },
          { id: 'doc-2', title: 'ch2.tex', isPinned: true },
        ],
        'doc-2',
        {
          storage: sharedLocalStorage,
          sessionStorage: windowBSession,
          splitMode: 'none',
          secondaryTabId: null,
        },
      );

      const loadedA = loadEditorTabsForPage('page-reload', {
        storage: sharedLocalStorage,
        sessionStorage: windowASession,
      });
      const loadedB = loadEditorTabsForPage('page-reload', {
        storage: sharedLocalStorage,
        sessionStorage: windowBSession,
      });
      expect(loadedA.activeTabId).toBe('doc-1');
      expect(loadedA.splitMode).toBe('vertical');
      expect(loadedA.secondaryTabId).toBe('doc-2');
      expect(loadedB.activeTabId).toBe('doc-2');
      expect(loadedB.splitMode).toBe('none');
      expect(loadedB.secondaryTabId).toBeNull();

      // F5 hydrate honours URL ?file= override when present
      setEditorWindowStorageProvider(windowASession);
      useWorkspaceStore.setState({ tabsByProject: {}, activeByProject: {}, secondaryActiveByProject: {} });
      useWorkspaceStore.getState().hydratePageTabs('page-reload', {
        rootDocId: 'page-reload',
        urlFileId: 'doc-2',
      });
      expect(useWorkspaceStore.getState().activeByProject['page-reload']).toBe('doc-2');

      // LRU pruning at MAX_PERSISTED_EDITOR_PAGES (30)
      for (let i = 1; i <= MAX_PERSISTED_EDITOR_PAGES + 5; i++) {
        saveEditorTabsForPage(
          `bulk-page-${i}`,
          [{ id: `bulk-page-${i}`, title: 'main.tex', isRoot: true, isPinned: true }],
          `bulk-page-${i}`,
        );
      }
      const rawEnvelope = JSON.parse(
        sharedLocalStorage.getItem(EDITOR_STORAGE_KEYS.EDITOR_TABS) ?? '{}',
      ) as { pages?: Record<string, unknown> };
      expect(Object.keys(rawEnvelope.pages ?? {})).toHaveLength(MAX_PERSISTED_EDITOR_PAGES);
    });
  });

  describe('6. Warm CodeMirror 6 EditorState & Undo History Recovery', () => {
    it('restores serialized undo stack via buildEditorState and falls back safely on content mismatch', () => {
      const adapter = new YjsCodeMirrorAdapter();
      const baseOptions = {
        fileId: 'doc-warm',
        filePath: 'chapters/warm.tex',
        readOnly: false,
        lineNumbers: true,
        wordWrap: false,
        keybinding: 'standard' as const,
        errorLensEnabled: false,
        spellCheck: false,
        spellCheckLanguage: 'en',
        editorTheme: 'light',
        fontSize: 14,
        editorMode: 'code',
        trackChangesViewMode: 'changes',
        reviewMode: false,
        collabAdapter: adapter,
        viewUpdateListener: [],
      };

      const initialState = buildEditorState({
        ...baseOptions,
        initialText: 'hello',
      });
      const editedState = initialState.update({
        changes: { from: 5, insert: ' world' },
      }).state;

      const stateJson = editedState.toJSON({ history: historyField });
      warmEditorStatePool.put('doc-warm', {
        fileId: 'doc-warm',
        content: 'hello world',
        stateJson,
        foldedRanges: [],
        savedAt: Date.now(),
      });

      let restoredState = buildEditorState({
        ...baseOptions,
        initialText: 'hello world',
        warmSnapshot: warmEditorStatePool.get('doc-warm'),
      });
      expect(restoredState.doc.toString()).toBe('hello world');

      const didUndo = undo({
        state: restoredState,
        dispatch: (tr) => {
          restoredState = tr.state;
        },
      });
      expect(didUndo).toBe(true);
      expect(restoredState.doc.toString()).toBe('hello');

      // Mismatched content ignores stale snapshot and builds fresh state without crashing
      const freshState = buildEditorState({
        ...baseOptions,
        initialText: 'remote changed text',
        warmSnapshot: warmEditorStatePool.get('doc-warm'),
      });
      expect(freshState.doc.toString()).toBe('remote changed text');
    });
  });

  describe('7. Multi-Tab Single-Leader Offline Mutation Replay Mutex', () => {
    it('allows only one leader to replay offline mutations concurrently via withWebLock', async () => {
      // Simulate JSDOM without navigator.locks -> exercises deterministic in-process ifAvailable lock
      const nav = navigator as unknown as { locks?: unknown };
      const hadLocks = 'locks' in nav;
      const prevLocks = nav.locks;
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: undefined,
      });

      let resolveFetch!: (val: never[]) => void;
      const pendingPromise = new Promise<never[]>((resolve) => {
        resolveFetch = resolve;
      });
      const spy = vi
        .spyOn(draftStorageService, 'getPendingMutations')
        .mockReturnValueOnce(pendingPromise)
        .mockResolvedValue([]);

      try {
        expect(EDITOR_LIMITS.OFFLINE_REPLAY_LOCK_NAME).toBe('flux:editor:offline-mutations-replay');
        const firstCall = sessionCoordinator.replayPendingMutations();
        const concurrentSecondCall = sessionCoordinator.replayPendingMutations();

        // Second caller exits immediately with 0s because lock is held by firstCall
        expect(await concurrentSecondCall).toEqual({ total: 0, succeeded: 0, failed: 0 });
        expect(spy).toHaveBeenCalledTimes(1);

        resolveFetch([]);
        expect(await firstCall).toEqual({ total: 0, succeeded: 0, failed: 0 });
      } finally {
        if (hadLocks) {
          Object.defineProperty(navigator, 'locks', {
            configurable: true,
            value: prevLocks,
          });
        } else {
          delete (navigator as { locks?: unknown }).locks;
        }
      }
    });
  });

  describe('8. EditorTabs UI Integration (Disambiguation, Dirty Dot, Pinning & Prefetch)', () => {
    it('renders disambiguated badges, reactive dirty dot, italic preview pinning, and hover prefetch', () => {
      const store = useWorkspaceStore.getState();
      store.openTab('page-ui', {
        id: 'page-ui',
        title: 'main.tex',
        isRoot: true,
        isPinned: true,
      });
      store.openTab('page-ui', {
        id: 'doc-a',
        title: 'chapters/intro/result.tex',
        path: 'chapters/intro/result.tex',
        isPinned: true,
      });
      store.openTab('page-ui', {
        id: 'doc-b',
        title: 'chapters/discussion/result.tex',
        path: 'chapters/discussion/result.tex',
        isPinned: true,
      });
      store.openTab('page-ui', {
        id: 'doc-prev',
        title: 'appendix/preview.tex',
        path: 'appendix/preview.tex',
        isPreview: true,
        isPinned: false,
      });

      const prefetchSpy = vi
        .spyOn(navigationCoordinator, 'prefetchDocument')
        .mockResolvedValue(undefined);

      render(<EditorTabs rootPageId="page-ui" activeFileId="doc-a" />);

      expect(screen.getByTestId('tab-disambiguator-doc-a')).toHaveTextContent('chapters/intro');
      expect(screen.getByTestId('tab-disambiguator-doc-b')).toHaveTextContent('chapters/discussion');

      // Reactive dirty dot via useSyncExternalStore + lruDocumentCache
      expect(screen.queryByTestId('tab-dirty-dot-doc-a')).not.toBeInTheDocument();
      act(() => {
        lruDocumentCache.registerModel('doc-a', { content: 'clean' });
        lruDocumentCache.updateContent('doc-a', 'edited', true);
      });
      expect(screen.getByTestId('tab-dirty-dot-doc-a')).toBeInTheDocument();

      // Preview tab is italic & marked data-preview="true"; double-click promotes to pinned
      const previewTab = screen.getByRole('tab', { name: 'Tab: appendix/preview.tex' });
      expect(previewTab).toHaveAttribute('data-preview', 'true');
      fireEvent.doubleClick(previewTab);
      expect(previewTab).not.toHaveAttribute('data-preview');

      // Hovering tab triggers prefetchDocument
      fireEvent.mouseEnter(screen.getByRole('tab', { name: 'Tab: chapters/discussion/result.tex' }));
      expect(prefetchSpy).toHaveBeenCalledWith('doc-b', 'chapters/discussion/result.tex');
    });
  });

  describe('9. Overleaf 1:1 Tab UX Parity (Unlimited Tabs, Default Preview OFF, Close Right, Debounced Save)', () => {
    it('defaults previewEditorTabs to false and keeps 25+ open user tabs without forced auto-eviction', () => {
      expect(useSettingsStore.getInitialState().previewEditorTabs).toBe(false);

      const store = useWorkspaceStore.getState();
      store.openTab('page-many', {
        id: 'page-many',
        title: 'main.tex',
        isRoot: true,
        isPinned: true,
      });

      for (let i = 1; i <= 25; i++) {
        store.openTab('page-many', {
          id: `chapter-${i}`,
          title: `chapters/ch-${i}.tex`,
          path: `chapters/ch-${i}.tex`,
          isPinned: true,
          isPreview: false,
        });
      }

      const tabs = useWorkspaceStore.getState().tabsByProject['page-many'] ?? [];
      expect(tabs).toHaveLength(26);
      expect(tabs.some((t) => t.id === 'chapter-1')).toBe(true);
      expect(tabs.some((t) => t.id === 'chapter-25')).toBe(true);
    });

    it('closes clean tabs to the right while protecting dirty/root tabs and routes active tab safely', () => {
      usePageStore.setState({
        parentPageId: 'page-right',
        currentPage: { id: 'page-right', title: 'main.tex', status: 'draft' } as never,
      });

      navigationCoordinator.openDocument({
        fileId: 'page-right',
        title: 'main.tex',
        content: 'root',
      });
      navigationCoordinator.openDocument({
        fileId: 'tab-1',
        title: 'ch1.tex',
        content: '1',
      });
      navigationCoordinator.openDocument({
        fileId: 'tab-2',
        title: 'ch2.tex',
        content: '2',
      });
      navigationCoordinator.openDocument({
        fileId: 'tab-3',
        title: 'ch3.tex',
        content: '3',
      });
      navigationCoordinator.openDocument({
        fileId: 'tab-4',
        title: 'ch4.tex',
        content: '4',
      });

      // Mark tab-3 dirty while keeping tab-4 active and clean
      lruDocumentCache.updateContent('tab-3', '3 modified', true);
      expect(useWorkspaceStore.getState().activeByProject['page-right']).toBe('tab-4');

      navigationCoordinator.closeDocumentsToRight('tab-1');

      const remaining = useWorkspaceStore.getState().tabsByProject['page-right'] ?? [];
      expect(remaining.map((t) => t.id)).toEqual(['page-right', 'tab-1', 'tab-3']);
      // Active tab (tab-4) was closed so focus falls back to pivot/remaining without stranding
      expect(useWorkspaceStore.getState().activeByProject['page-right']).toBe('tab-1');
    });

    it('debounces localStorage writes on pure setActiveTab switches and flushes immediately on read', () => {
      vi.useFakeTimers();
      try {
        const store = useWorkspaceStore.getState();
        store.openTab('page-debounce', {
          id: 'page-debounce',
          title: 'main.tex',
          isRoot: true,
          isPinned: true,
        });
        store.openTab('page-debounce', { id: 't1', title: 't1.tex', isPinned: true });
        store.openTab('page-debounce', { id: 't2', title: 't2.tex', isPinned: true });
        store.openTab('page-debounce', { id: 't3', title: 't3.tex', isPinned: true });

        const setItemSpy = vi.spyOn(sharedLocalStorage, 'setItem');
        setItemSpy.mockClear();

        store.setActiveTab('page-debounce', 't1');
        store.setActiveTab('page-debounce', 't2');
        store.setActiveTab('page-debounce', 't3');

        // Rapid active-tab clicks incur 0 immediate localStorage writes while sessionStorage stays instant
        expect(setItemSpy).toHaveBeenCalledTimes(0);

        vi.advanceTimersByTime(160);
        expect(setItemSpy).toHaveBeenCalledTimes(1);

        const loaded = loadEditorTabsForPage('page-debounce');
        expect(loaded.activeTabId).toBe('t3');

        // Also verifies immediate synchronous flush before timer fires
        setItemSpy.mockClear();
        store.setActiveTab('page-debounce', 't1');
        expect(setItemSpy).toHaveBeenCalledTimes(0);
        const flushedBeforeTimer = loadEditorTabsForPage('page-debounce');
        expect(flushedBeforeTimer.activeTabId).toBe('t1');
        flushPendingEditorTabSaves();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
