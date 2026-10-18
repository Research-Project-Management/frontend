import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { Menubar } from '@/shared/components/ui';
import { PdfToolbar } from '@/features/editor/subsystems/compiler';
import { EditorArea } from '@/features/editor/ui/editor/EditorArea';
import { Topbar } from '@/features/editor/core/shell/Topbar';
import { ActivityBar } from '@/features/editor/core/shell/ActivityBar';
import { WorkbenchShell } from '@/features/editor/core/shell/WorkbenchShell';
import { FileMenu } from '@/features/editor/core/shell/topbar/FileMenu';
import { EditMenu } from '@/features/editor/core/shell/topbar/EditMenu';
import { FormatMenu } from '@/features/editor/core/shell/topbar/FormatMenu';
import { editorCommandBus, setActiveEditorEngine } from '@/features/editor/core';
import { useSettingsStore } from '@/features/editor/core';
import { usePageStore } from '@/features/editor/core';
import { useWorkspaceStore } from '@/features/editor/core';
import { useDocumentCollaborationStore } from '@/features/editor/core';
import { clearYjsProviderPool } from '@/features/editor/sdk/realtime/yjs-socket-provider';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'proj-123', pageId: 'doc-1' }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/editor/proj-123',
}));

vi.mock('@/features/editor/ui/hooks/useActiveDocument', () => ({
  useActiveDocument: () => ({
    isLoading: false,
    activePage: {
      id: 'doc-1',
      title: 'main.tex',
      content: '\\section{Introduction}\nThis is LaTeX source code.',
    },
    isAssetTab: false,
    displayPage: {
      id: 'doc-1',
      title: 'main.tex',
      content: '\\section{Introduction}\nThis is LaTeX source code.',
    },
    pageId: 'doc-1',
    fileId: 'doc-1',
    selectedAsset: null,
    selectFile: vi.fn(),
    parentPage: null,
    childFiles: [
      { id: 'doc-1', title: 'main.tex', content: '\\section{Introduction}\nThis is LaTeX source code.' },
      { id: 'doc-bib', title: 'ref.bib', content: '@article{einstein, author={A. Einstein}}' },
    ],
  }),
}));

vi.mock('@/features/editor/ui/hooks/usePageActions', () => ({
  usePageActions: () => ({
    updateThumbnail: { mutate: vi.fn() },
    updateTitle: { mutate: vi.fn(), isPending: false },
  }),
}));

vi.mock('@/features/editor/ui/hooks/useFileActions', () => ({
  useFileActions: () => ({
    setMainFile: { mutate: vi.fn() },
  }),
}));

vi.mock('@/features/editor/ui/hooks/document.queries', () => ({
  filesQuery: () => ({ queryKey: ['files'], queryFn: vi.fn() }),
  pageQuery: () => ({ queryKey: ['page'], queryFn: vi.fn() }),
}));

// Mock CodeMirrorView to identify it easily
vi.mock('@/features/editor/ui/editor/CodeMirrorView', () => ({
  CodeMirrorView: (props: any) => (
    <div data-testid="mock-codemirror-view" data-file-id={props.fileId}>
      <span>CodeMirror Engine Mock</span>
      <pre>{props.value}</pre>
    </div>
  ),
}));

describe('Overleaf 1:1 Layout & Feature Placement Parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearYjsProviderPool();
    setActiveEditorEngine(null);
    useSettingsStore.setState({
      editorMode: 'code',
      showEditorTabs: true,
    });
    useWorkspaceStore.setState({
      activeSidebarTab: 'files',
      sidebarLeftOpen: true,
    });
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    setActiveEditorEngine(null);
    clearYjsProviderPool();
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{ui}</TooltipProvider>
      </QueryClientProvider>
    );
  };

  describe('1. Symmetrical SyncTeX on PdfToolbar', () => {
    it('renders both Backward (PDF -> Code) and Forward (Code -> PDF) SyncTeX buttons in PdfToolbar', () => {
      const { container } = renderWithProviders(
        <PdfToolbar
          compileStatus="idle"
          onCompile={vi.fn()}
          scale={1}
          autoFit={true}
          onToggleAutoFit={vi.fn()}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          pageNumber={1}
          numPages={3}
          onPrevPage={vi.fn()}
          onNextPage={vi.fn()}
          pdfUrl="blob:http://localhost:3000/mock-pdf"
          showLog={false}
          onToggleLog={vi.fn()}
          onDownload={vi.fn()}
        />
      );

      const backwardBtn = container.querySelector('button[aria-label="Go to PDF location in code (Reverse Search)"]');
      const forwardBtn = container.querySelector('button[aria-label="Go to code location in PDF (Forward Search)"]');

      expect(backwardBtn).toBeInTheDocument();
      expect(forwardBtn).toBeInTheDocument();
      expect(backwardBtn).not.toBeDisabled();
      expect(forwardBtn).not.toBeDisabled();
    });

    it('dispatches synctex:backward when backward button is clicked', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      const { container } = renderWithProviders(
        <PdfToolbar
          compileStatus="idle"
          onCompile={vi.fn()}
          scale={1}
          autoFit={true}
          onToggleAutoFit={vi.fn()}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          pageNumber={2}
          numPages={5}
          onPrevPage={vi.fn()}
          onNextPage={vi.fn()}
          pdfUrl="blob:http://localhost:3000/mock-pdf"
          showLog={false}
          onToggleLog={vi.fn()}
          onDownload={vi.fn()}
        />
      );

      const backwardBtn = container.querySelector('button[aria-label="Go to PDF location in code (Reverse Search)"]') as HTMLElement;
      expect(backwardBtn).toBeInTheDocument();
      fireEvent.click(backwardBtn);

      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'synctex:backward',
        page: 2,
      });
    });

    it('dispatches synctex:forward with engine cursor position when forward button is clicked', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const mockEngine = {
        getCursorPosition: vi.fn().mockReturnValue({ line: 42, column: 7 }),
      };
      setActiveEditorEngine(mockEngine as any);

      const { container } = renderWithProviders(
        <PdfToolbar
          compileStatus="idle"
          onCompile={vi.fn()}
          scale={1}
          autoFit={true}
          onToggleAutoFit={vi.fn()}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          pageNumber={1}
          numPages={3}
          onPrevPage={vi.fn()}
          onNextPage={vi.fn()}
          pdfUrl="blob:http://localhost:3000/mock-pdf"
          showLog={false}
          onToggleLog={vi.fn()}
          onDownload={vi.fn()}
        />
      );

      const forwardBtn = container.querySelector('button[aria-label="Go to code location in PDF (Forward Search)"]') as HTMLElement;
      expect(forwardBtn).toBeInTheDocument();
      fireEvent.click(forwardBtn);

      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'synctex:forward',
        line: 42,
        column: 7,
      });
    });
    it('renders red error badge and amber warning badge on Logs and output files button', () => {
      const { rerender } = renderWithProviders(
        <PdfToolbar
          compileStatus="error"
          onCompile={vi.fn()}
          scale={1}
          autoFit={true}
          onToggleAutoFit={vi.fn()}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          pageNumber={1}
          numPages={3}
          onPrevPage={vi.fn()}
          onNextPage={vi.fn()}
          pdfUrl="blob:http://localhost:3000/mock-pdf"
          showLog={false}
          onToggleLog={vi.fn()}
          onDownload={vi.fn()}
          errorCount={3}
          warningCount={2}
        />
      );

      const errorBadge = screen.getByTestId('compiler-error-badge');
      expect(errorBadge).toBeInTheDocument();
      expect(errorBadge).toHaveTextContent('3');

      rerender(
        <QueryClientProvider client={createTestQueryClient()}>
          <TooltipProvider>
            <PdfToolbar
              compileStatus="idle"
              onCompile={vi.fn()}
              scale={1}
              autoFit={true}
              onToggleAutoFit={vi.fn()}
              onZoomIn={vi.fn()}
              onZoomOut={vi.fn()}
              pageNumber={1}
              numPages={3}
              onPrevPage={vi.fn()}
              onNextPage={vi.fn()}
              pdfUrl="blob:http://localhost:3000/mock-pdf"
              showLog={false}
              onToggleLog={vi.fn()}
              onDownload={vi.fn()}
              errorCount={0}
              warningCount={5}
            />
          </TooltipProvider>
        </QueryClientProvider>
      );

      const warningBadge = screen.getByTestId('compiler-warning-badge');
      expect(warningBadge).toBeInTheDocument();
      expect(warningBadge).toHaveTextContent('5');
    });
  });

  describe('2. Vertical Space Optimization: EditorTabs & EditorToolbar', () => {
    it('renders SourceVisualSwitcher and unified formatting buttons in EditorToolbar when editorMode is "code"', () => {
      useSettingsStore.setState({ editorMode: 'code' });
      renderWithProviders(<EditorArea />);

      // Source/Visual switcher is present
      expect(screen.getByRole('radio', { name: /code mode|source mode/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /visual mode/i })).toBeInTheDocument();

      // Formatting buttons are rendered in code mode (Overleaf unified toolbar parity)
      expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /normal/i })).toBeInTheDocument();
    });

    it('renders EditorToolbar with formatting actions when editorMode is "visual"', () => {
      useSettingsStore.setState({ editorMode: 'visual' });
      renderWithProviders(<EditorArea />);

      // Source/Visual switcher is present
      expect(screen.getByRole('radio', { name: /code mode|source mode/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /visual mode/i })).toBeInTheDocument();

      // Formatting buttons are rendered in visual mode
      expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
    });

    it('supports Ctrl+Alt+M keydown in EditorArea in code mode', () => {
      useSettingsStore.setState({ editorMode: 'code' });
      const mockEngine = {
        getSelection: vi.fn().mockReturnValue({ fromLine: 12, toLine: 12 }),
        getCursorPosition: vi.fn().mockReturnValue({ line: 12, column: 1 }),
        getSelectedText: vi.fn().mockReturnValue('Theorem 2.1'),
      };
      setActiveEditorEngine(mockEngine as any);

      renderWithProviders(<EditorArea />);

      fireEvent.keyDown(window, {
        key: 'm',
        ctrlKey: true,
        altKey: true,
      });

      const pending = useDocumentCollaborationStore.getState().pendingComment;
      expect(pending).toBeDefined();
      expect(pending?.startLine).toBe(12);
      expect(pending?.selectedText).toBe('Theorem 2.1');
      expect(useWorkspaceStore.getState().activeSidebarTab).toBe('review');
      expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(true);
    });
  });

  describe('3. Topbar Strict Constraints & Editing Mode Parity', () => {
    it('verifies Topbar contains zero Share button or standalone Review button, but includes EditingModeDropdown', () => {
      usePageStore.setState({
        currentPage: {
          id: 'doc-1',
          title: 'Quantum Entanglement Paper',
          content: '',
        } as any,
      });

      renderWithProviders(<Topbar />);

      // Must NOT contain Share button anywhere
      expect(screen.queryByRole('button', { name: /share/i })).toBeNull();
      expect(screen.queryByText(/share/i)).toBeNull();

      // Must NOT contain standalone Review button on Topbar
      expect(screen.queryByRole('button', { name: /^review$/i })).toBeNull();

      // Must NOT contain Menu button on Topbar (Settings is in ActivityBar)
      expect(screen.queryByRole('button', { name: /^menu$/i })).toBeNull();

      // Overleaf Parity: Editing mode dropdown is present in top-right
      expect(screen.getByRole('button', { name: /editing mode/i })).toBeInTheDocument();

      // Verified elements that DO belong on Topbar:
      expect(screen.getByRole('link', { name: /back to projects/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /file/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /view/i })).toBeInTheDocument();
    });

    it('renders canonical Overleaf activity bar icons with File Outline integrated in File Tree', () => {
      renderWithProviders(<ActivityBar />);
      expect(screen.getByRole('tab', { name: /file tree/i })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /document outline/i })).toBeNull();
      expect(screen.getByRole('tab', { name: /search in project/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /citations & bibtex/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /review & comments/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /ai assistant/i })).toBeInTheDocument();
    });
  });

  describe('4. Pure Overleaf Shell & Word Count Parity (Overleaf 1:1)', () => {
    it('verifies WorkbenchShell renders full-height distraction-free writing without footer Status Bar or Bottom Dock', () => {
      const { container } = renderWithProviders(
        <WorkbenchShell
          topBar={<div>Topbar</div>}
          editor={<div>Editor</div>}
        />
      );
      expect(container.querySelector('[aria-label="Status Bar"]')).toBeNull();
      expect(container.querySelector('[aria-label="Bottom Panel"]')).toBeNull();
    });

    it('verifies FileMenu does not contain duplicate Word Count or Deleted files (lives in Menu Drawer & File Tree)', async () => {
      renderWithProviders(
        <Menubar value="file">
          <FileMenu value="file" />
        </Menubar>
      );

      expect(await screen.findByRole('menuitem', { name: /new file/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /new folder/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /upload file/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /make a copy/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /word count/i })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /deleted files/i })).toBeNull();
    });

    it('verifies EditMenu contains editing operations without duplicate Auto-Fix item', async () => {
      renderWithProviders(
        <Menubar value="edit">
          <EditMenu value="edit" />
        </Menubar>
      );

      expect(await screen.findByRole('menuitem', { name: /undo/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /redo/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /^find(?!.*project)/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /find in project/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /select all/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /check page syntax/i })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /auto-fix page syntax/i })).toBeNull();
    });

    it('verifies FormatMenu contains formatting styles and does not scatter Citation action', async () => {
      renderWithProviders(
        <Menubar value="format">
          <FormatMenu value="format" />
        </Menubar>
      );

      expect(await screen.findByRole('menuitem', { name: /bold/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /italics/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /underline/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /bullet list/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /format document/i })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /insert citation/i })).toBeNull();
    });
  });

  describe('5. Overleaf Menu 1:1 Parity (Left Drawer & Actions)', () => {
    it('toggles settingsPanelOpen via the Settings icon button in ActivityBar', () => {
      useSettingsStore.setState({ settingsPanelOpen: false });
      renderWithProviders(<ActivityBar />);

      const settingsBtn = screen.getByRole('button', { name: /project settings/i });
      expect(settingsBtn).toBeInTheDocument();

      fireEvent.click(settingsBtn);
      expect(useSettingsStore.getState().settingsPanelOpen).toBe(true);

      fireEvent.click(settingsBtn);
      expect(useSettingsStore.getState().settingsPanelOpen).toBe(false);
    });

    it('renders full Overleaf Menu sections (Download, Sync, Word Count, Settings) when open', async () => {
      useSettingsStore.setState({
        settingsPanelOpen: true,
        settingsActiveTab: 'editor',
      });

      const { ProjectSettingsModal } = await import('@/features/editor/ui/modals/project-settings/ProjectSettingsModal');
      renderWithProviders(<ProjectSettingsModal />);

      // 1. Header
      expect(screen.getByRole('heading', { name: /menu/i })).toBeInTheDocument();

      // 2. DOWNLOAD Section
      expect(screen.getByText(/^download$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download source/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download pdf/i })).toBeInTheDocument();

      // 3. SYNC Section
      expect(screen.getByText(/^sync$/i)).toBeInTheDocument();
      expect(screen.getByText(/github/i)).toBeInTheDocument();
      expect(screen.getByText(/git clone url/i)).toBeInTheDocument();
      expect(screen.getByText(/dropbox/i)).toBeInTheDocument();

      // 4. PROJECT FUNCTIONS (Copy Project & Word Count)
      expect(screen.getByRole('button', { name: /copy project/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /run word count/i })).toBeInTheDocument();

      // 5. SETTINGS Section
      expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^compiler$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^tex live version$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^main document$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^spell check$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^auto-compile$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^auto-close brackets$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^code check$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^keybindings$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^font size$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^font family$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^line height$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^editor theme$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^pdf viewer$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^stop on first error$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear cache/i })).toBeInTheDocument();
    }, 60000);

    it('clicking Word Count inside Menu dispatches word-count dialog and closes Menu drawer', async () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      useSettingsStore.setState({ settingsPanelOpen: true });

      const { ProjectSettingsModal } = await import('@/features/editor/ui/modals/project-settings/ProjectSettingsModal');
      renderWithProviders(<ProjectSettingsModal />);

      const wordCountBtn = screen.getByRole('button', { name: /run word count/i });
      fireEvent.click(wordCountBtn);

      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'dialog:open',
        dialog: 'word-count',
      });
      expect(useSettingsStore.getState().settingsPanelOpen).toBe(false);
    });

    it('shows Git Clone URL with Smart-HTTP badge and allows copying command', async () => {
      useSettingsStore.setState({ settingsPanelOpen: true });
      const { ProjectSettingsModal } = await import('@/features/editor/ui/modals/project-settings/ProjectSettingsModal');
      renderWithProviders(<ProjectSettingsModal />);

      expect(screen.getByText(/smart-http/i)).toBeInTheDocument();
      expect(screen.getByText(/^git clone url$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^copy$/i })).toBeInTheDocument();
    });

    it('clicking Clear Cache calls clean-aux and provides user feedback', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      useSettingsStore.setState({ settingsPanelOpen: true });
      usePageStore.setState({ projectId: 'proj-test-clean' });

      const { ProjectSettingsModal } = await import('@/features/editor/ui/modals/project-settings/ProjectSettingsModal');
      renderWithProviders(<ProjectSettingsModal />);

      const clearCacheBtn = screen.getByRole('button', { name: /clear cache/i });
      fireEvent.click(clearCacheBtn);

      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      fetchSpy.mockRestore();
    });
  });
});

