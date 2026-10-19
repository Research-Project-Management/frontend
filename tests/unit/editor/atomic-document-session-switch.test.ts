import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sessionCoordinator,
  usePageStore,
  useWorkspaceStore,
  setActiveEditorEngine,
  type IEditorEngine,
} from '@/features/editor/core';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { useCompileStore } from '@/features/editor/subsystems/compiler';

describe('Atomic Document Session & Tab Lifecycle Deep Module', () => {
  const projectId = 'proj-atomic-123';
  const rootPageId = 'doc-root-main';

  beforeEach(() => {
    vi.useFakeTimers();
    lruDocumentCache.clear();
    useWorkspaceStore.getState().closeAllTabsForProject(projectId);
    useCompileStore.getState().clearAllDirty();

    usePageStore.setState({
      projectId,
      currentPage: { id: rootPageId, title: 'main.tex' } as any,
      activeFilePage: { id: rootPageId, title: 'main.tex' } as any,
    });
  });

  afterEach(() => {
    setActiveEditorEngine(null);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('atomically flushes uncommitted active editor buffer into outgoing model on file switch', () => {
    // 1. Setup initial model for fileA
    lruDocumentCache.registerModel('file-a', {
      content: 'Original content of File A',
      filePath: 'chapter1.tex',
      projectId,
    });
    navigationCoordinator.openDocument({
      fileId: 'file-a',
      title: 'chapter1.tex',
      path: 'chapter1.tex',
    });
    expect(sessionCoordinator.getFsmState('file-a')).toBe('active');

    // Mock active editor engine with unsaved edits
    const mockEngine: Partial<IEditorEngine> = {
      getContent: () => 'Uncommitted live keystrokes in File A',
      focus: vi.fn(),
    };
    setActiveEditorEngine(mockEngine as IEditorEngine);

    // 2. Setup model for fileB
    lruDocumentCache.registerModel('file-b', {
      content: 'Hello File B',
      filePath: 'chapter2.tex',
      projectId,
    });

    // 3. Atomically switch to fileB
    navigationCoordinator.openDocument({
      fileId: 'file-b',
      title: 'chapter2.tex',
      path: 'chapter2.tex',
    });

    // 4. Verification:
    // File A must have captured the live keystrokes and marked dirty
    const modelA = lruDocumentCache.getModel('file-a');
    expect(modelA?.content).toBe('Uncommitted live keystrokes in File A');
    expect(modelA?.isDirty).toBe(true);
    expect(useCompileStore.getState().getDirtyFiles().some((d) => d.fileId === 'file-a')).toBe(true);

    // File A FSM is deactivated, File B is active
    expect(sessionCoordinator.getFsmState('file-b')).toBe('active');
    expect(lruDocumentCache.getActiveFileId()).toBe('file-b');

    // PageStore and WorkspaceStore are in sync
    expect(usePageStore.getState().getActiveDocumentId()).toBe('file-b');
    expect(useWorkspaceStore.getState().activeByProject[projectId]).toBe('file-b');
  });

  it('registers in-memory model in LRU cache if opening a new file without pre-existing model', () => {
    expect(lruDocumentCache.getModel('file-new')).toBeUndefined();

    navigationCoordinator.openDocument({
      fileId: 'file-new',
      title: 'notes.tex',
      path: 'notes.tex',
    });

    const registered = lruDocumentCache.getModel('file-new');
    expect(registered).toBeDefined();
    expect(registered?.filePath).toBe('notes.tex');
    expect(sessionCoordinator.getFsmState('file-new')).toBe('active');
    expect(useWorkspaceStore.getState().activeByProject[projectId]).toBe('file-new');
  });

  it('closeDocument flushes, evicts model, and routes to adjacent tab', () => {
    lruDocumentCache.registerModel('file-1', { content: 'Doc 1', filePath: 'doc1.tex', projectId });
    lruDocumentCache.registerModel('file-2', { content: 'Doc 2', filePath: 'doc2.tex', projectId });

    navigationCoordinator.openDocument({ fileId: 'file-1', title: 'doc1.tex' });
    navigationCoordinator.openDocument({ fileId: 'file-2', title: 'doc2.tex' });

    expect(useWorkspaceStore.getState().activeByProject[projectId]).toBe('file-2');

    // Close file-2
    navigationCoordinator.closeDocument('file-2');

    // file-2 is evicted from LRU cache
    expect(lruDocumentCache.getModel('file-2')).toBeUndefined();

    // Tabs router reverts to remaining tab
    const activeTab = useWorkspaceStore.getState().activeByProject[projectId];
    expect(activeTab).toBe('file-1');
  });
});
