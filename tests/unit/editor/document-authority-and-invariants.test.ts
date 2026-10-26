import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  documentAuthority,
  editorInvariantMonitor,
  sessionCoordinator,
  usePageStore,
  useWorkspaceStore,
  registerEditorEngine,
  unregisterEditorEngine,
  setActiveEditorEngine,
  type IEditorEngine,
} from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  useCompileStore,
  CompilationSnapshotProvider,
} from '@/features/editor/subsystems/compiler';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import { aiCoordinator } from '@/features/editor/subsystems/ai/coordinator/ai.coordinator';
import { executeProjectCitekeyRefactor } from '@/features/editor/subsystems/citation/model/citation-refactor';

describe('DocumentAuthorityFacade & EditorStateInvariantMonitor Deep Module', () => {
  const projectId = 'proj-authority-999';
  const rootPageId = 'page-root-999';

  beforeEach(() => {
    lruDocumentCache.clear();
    documentAuthority.clearProjectCache();
    useWorkspaceStore.getState().closeAllTabsForProject(projectId);
    useWorkspaceStore.getState().closeAllTabsForProject(rootPageId);
    useCompileStore.getState().clearAllDirty();

    usePageStore.setState({
      projectId,
      parentPageId: rootPageId,
      activePageId: 'file-main',
      currentPage: { id: 'file-main', title: 'main.tex', content: '\\documentclass{article}\nServer baseline' } as any,
      activeFilePage: { id: 'file-main', title: 'main.tex', content: '\\documentclass{article}\nServer baseline' } as any,
    });
  });

  afterEach(() => {
    setActiveEditorEngine(null);
    unregisterEditorEngine('file-main');
    unregisterEditorEngine('file-sec');
    vi.restoreAllMocks();
  });

  it('resolves document content with strict priority: Mounted Engine > LRU Cache > PageStore > Server Read Model', () => {
    // 1. Hydrate server files
    documentAuthority.hydrateServerProjectFiles(projectId, [
      { id: 'file-main', title: 'main.tex', path: 'main.tex', content: 'Server Main' },
      { id: 'file-sec', title: 'sec.tex', path: 'sections/sec.tex', content: 'Server Section' },
    ]);

    expect(documentAuthority.getDocumentContent('file-sec')).toBe('Server Section');

    // 2. Register in LRU cache -> overrides server read model
    lruDocumentCache.registerModel('file-sec', {
      content: 'LRU Cached Section',
      filePath: 'sections/sec.tex',
      projectId,
    });
    expect(documentAuthority.getDocumentContent('file-sec')).toBe('LRU Cached Section');

    // 3. Mount a split-pane CodeMirror engine for file-sec -> overrides LRU cache
    const secEngine: Partial<IEditorEngine> = {
      getContent: () => 'Live Split-Pane Keystrokes in Section',
    };
    registerEditorEngine('file-sec', secEngine as IEditorEngine);
    expect(documentAuthority.getDocumentContent('file-sec')).toBe(
      'Live Split-Pane Keystrokes in Section',
    );

    // 4. Overlay files merge live engine + LRU + server baseline seamlessly
    const overlay = documentAuthority.getOverlayFiles(projectId);
    const secOverlay = overlay.find((f) => f.id === 'file-sec');
    expect(secOverlay?.content).toBe('Live Split-Pane Keystrokes in Section');
  });

  it('unidirectionally synchronizes lruDocumentCache.activeFileId when useWorkspaceStore active tab changes', () => {
    lruDocumentCache.registerModel('file-main', {
      content: 'Main',
      filePath: 'main.tex',
      projectId,
    });
    lruDocumentCache.registerModel('file-sec', {
      content: 'Sec',
      filePath: 'sec.tex',
      projectId,
    });

    useWorkspaceStore.getState().openTab(rootPageId, {
      id: 'file-main',
      title: 'main.tex',
      path: 'main.tex',
    });
    useWorkspaceStore.getState().openTab(rootPageId, {
      id: 'file-sec',
      title: 'sec.tex',
      path: 'sec.tex',
    });

    expect(lruDocumentCache.getActiveFileId()).toBe('file-sec');

    useWorkspaceStore.getState().setActiveTab(rootPageId, 'file-main');
    expect(lruDocumentCache.getActiveFileId()).toBe('file-main');
  });

  it('detects and self-heals cross-store dirty state and active file drift via EditorStateInvariantMonitor', () => {
    lruDocumentCache.registerModel('file-main', {
      content: 'Initial',
      filePath: 'main.tex',
      projectId,
    });
    // Mutate LRU model to dirty without updating useCompileStore
    lruDocumentCache.updateContent('file-main', 'Edited in LRU only', true);
    // Set an orphan dirty entry in useCompileStore for a clean file
    lruDocumentCache.registerModel('file-sec', {
      content: 'Clean sec',
      filePath: 'sec.tex',
      projectId,
    });
    useCompileStore.getState().markDirty('file-sec', 'Stale dirty');
    // Force activeFileId drift
    lruDocumentCache.setActiveFileId('file-sec');

    const beforeReport = editorInvariantMonitor.checkInvariants();
    expect(beforeReport.valid).toBe(false);
    expect(beforeReport.violations.map((v) => v.code)).toEqual(
      expect.arrayContaining([
        'DIRTY_FLAG_MISMATCH_MISSING_IN_COMPILE_STORE',
        'DIRTY_FLAG_MISMATCH_ORPHAN_IN_COMPILE_STORE',
        'ACTIVE_FILE_DRIFT',
      ]),
    );

    // Self-heal
    editorInvariantMonitor.reconcileInvariants();

    const afterReport = editorInvariantMonitor.checkInvariants();
    expect(afterReport.valid).toBe(true);
    expect(afterReport.violations).toHaveLength(0);
    expect(useCompileStore.getState().dirtyContentMap.get('file-main')).toBe('Edited in LRU only');
    expect(useCompileStore.getState().isDirtyFile('file-sec')).toBe(false);
    expect(lruDocumentCache.getActiveFileId()).toBe('file-main');
  });

  it('applies direct AI insertion to the specific split-pane engine for fileId instead of active engine', () => {
    let mainContent = 'Main content';
    let secContent = 'Section content';

    const mainEngine: Partial<IEditorEngine> = {
      getContent: () => mainContent,
      insertText: (text: string) => {
        mainContent += text;
      },
    };
    const secEngine: Partial<IEditorEngine> = {
      getContent: () => secContent,
      insertText: (text: string) => {
        secContent += text;
      },
    };

    registerEditorEngine('file-main', mainEngine as IEditorEngine);
    registerEditorEngine('file-sec', secEngine as IEditorEngine);
    setActiveEditorEngine(mainEngine as IEditorEngine);

    // file-sec is in split-pane (not active engine). Calling applyDirect for file-sec should insert into secEngine
    const applied = aiCoordinator.applyDirect('file-sec', 1, '\n% AI inserted comment');
    expect(applied).toBe(true);
    expect(secContent).toBe('Section content\n% AI inserted comment');
    expect(mainContent).toBe('Main content');
  });

  it('updates mounted split-pane engine when citekey is refactored across files', async () => {
    let secContent = '\\section{Ref}\nSee \\cite{oldKey2020} for details.';
    const secEngine: Partial<IEditorEngine> = {
      getContent: () => secContent,
      setContent: (c: string) => {
        secContent = c;
      },
    };
    registerEditorEngine('file-sec', secEngine as IEditorEngine);

    // Hydrate server files
    documentAuthority.hydrateServerProjectFiles(projectId, [
      { id: 'file-main', title: 'main.tex', path: 'main.tex', content: 'Main file' },
      { id: 'file-sec', title: 'sec.tex', path: 'sec.tex', content: 'Old server text' },
    ]);

    const mockService: any = {
      getFilesByProjectId: vi.fn(async () => [
        { id: 'file-main', title: 'main.tex', path: 'main.tex', content: 'Main file' },
        { id: 'file-sec', title: 'sec.tex', path: 'sec.tex', content: 'Old server text' },
      ]),
      updateFileContent: vi.fn(async () => ({})),
    };

    const result = await executeProjectCitekeyRefactor('oldKey2020', 'newKey2026', {
      projectId,
      service: mockService,
    });

    expect(result.success).toBe(true);
    expect(result.modifiedCount).toBe(1);
    expect(secContent).toBe('\\section{Ref}\nSee \\cite{newKey2026} for details.');
  });

  it('overlays all mounted split-pane engine buffers in CompilationSnapshotProvider.createSnapshot', () => {
    documentAuthority.hydrateServerProjectFiles(projectId, [
      { id: 'file-main', title: 'main.tex', path: 'main.tex', content: 'Server main' },
      { id: 'file-sec', title: 'sections/sec.tex', path: 'sections/sec.tex', content: 'Server sec' },
    ]);

    const mainEngine: Partial<IEditorEngine> = {
      getContent: () => 'Live primary main.tex buffer',
    };
    const secEngine: Partial<IEditorEngine> = {
      getContent: () => 'Live secondary split-pane sections/sec.tex buffer',
    };

    registerEditorEngine('file-main', mainEngine as IEditorEngine);
    registerEditorEngine('file-sec', secEngine as IEditorEngine);
    setActiveEditorEngine(mainEngine as IEditorEngine);

    const snapshot = CompilationSnapshotProvider.createSnapshot();
    expect(snapshot.files['main.tex']).toBe('Live primary main.tex buffer');
    expect(snapshot.files['sections/sec.tex']).toBe('Live secondary split-pane sections/sec.tex buffer');
  });

  it('focuses and jumps directly to secondary split-pane engine in navigationCoordinator.jumpToLine without opening duplicate primary tab', () => {
    documentAuthority.hydrateServerProjectFiles(projectId, [
      { id: 'file-main', title: 'main.tex', path: 'main.tex', content: 'Main' },
      { id: 'file-sec', title: 'sections/results.tex', path: 'sections/results.tex', content: 'Results' },
    ]);

    const jumpSpy = vi.fn();
    const secEngine: Partial<IEditorEngine> = {
      getContent: () => 'Results',
      jumpToLine: jumpSpy,
    };
    registerEditorEngine('file-sec', secEngine as IEditorEngine);

    const layout = useWorkspaceStore.getState();
    layout.setEditorSplitMode('vertical');
    layout.setSecondaryFileId('file-sec');
    layout.setActiveEditorPane('primary');

    navigationCoordinator.jumpToLine({
      filePath: 'sections/results.tex',
      line: 42,
      highlight: 'synctex',
    });

    expect(useWorkspaceStore.getState().activeEditorPane).toBe('secondary');
    expect(jumpSpy).toHaveBeenCalledWith(42, 'synctex');
    // Primary active document remains file-main
    expect(usePageStore.getState().activePageId).toBe('file-main');

    layout.setEditorSplitMode('none');
    layout.setSecondaryFileId(null);
  });

  it('prevents cross-pane content corruption when sessionCoordinator.switchTab is called while secondary split-pane is focused', () => {
    lruDocumentCache.registerModel('file-main', {
      content: 'Original primary content',
      filePath: 'main.tex',
      projectId,
    });
    lruDocumentCache.registerModel('file-sec', {
      content: 'Secondary split-pane content',
      filePath: 'sec.tex',
      projectId,
    });
    lruDocumentCache.registerModel('file-third', {
      content: 'Third tab content',
      filePath: 'third.tex',
      projectId,
    });

    const mainEngine: Partial<IEditorEngine> = {
      getContent: () => 'Edited primary content',
    };
    const secEngine: Partial<IEditorEngine> = {
      getContent: () => 'Edited secondary split-pane content',
    };

    registerEditorEngine('file-main', mainEngine as IEditorEngine);
    registerEditorEngine('file-sec', secEngine as IEditorEngine);
    // Simulate user having focused the secondary split-pane last
    setActiveEditorEngine(secEngine as IEditorEngine);

    // User clicks 'file-third' tab in the primary pane (switching from 'file-main' to 'file-third')
    sessionCoordinator.switchTab('file-main', 'file-third');

    // 'file-main' must receive mainEngine's content ('Edited primary content'), NEVER secEngine's content!
    expect(lruDocumentCache.getContent('file-main')).toBe('Edited primary content');
  });
});
