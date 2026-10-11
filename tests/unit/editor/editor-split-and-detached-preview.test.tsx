import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { EditorArea } from '@/features/editor/ui/features/editor/EditorArea';
import { PdfToolbar } from '@/features/editor/ui/features/preview/PdfToolbar';
import { editorCommandBus, setActiveEditorEngine } from '@/features/editor/coordinators/command-bus';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { usePageStore } from '@/features/editor/store/editor.store';
import { useLayoutStore } from '@/features/editor/store/layout.store';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'test-proj', pageId: 'doc-main' }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/projects/test-proj',
}));

vi.mock('@/features/editor/ui/hooks/use-active-document', () => {
  const defaultPage = {
    id: 'doc-main',
    title: 'main.tex',
    content: '\\section{Main}\nHello World',
  };
  const secondaryPage = {
    id: 'doc-bib',
    title: 'ref.bib',
    content: '@article{einstein, author={A. Einstein}}',
  };
  return {
    useActiveDocument: () => ({
      isLoading: false,
      activePage: defaultPage,
      isAssetTab: false,
      displayPage: defaultPage,
      pageId: 'doc-main',
      fileId: 'doc-main',
      selectedAsset: null,
      selectFile: vi.fn((id: string) => {
        usePageStore.setState({ activePageId: id });
      }),
      parentPage: null,
      childFiles: [defaultPage, secondaryPage],
    }),
  };
});

// Mock CodeMirrorView to identify which file is rendered in which pane
vi.mock('@/features/editor/ui/features/editor/CodeMirrorView', () => ({
  CodeMirrorView: (props: any) => (
    <div
      data-testid="mock-codemirror-view"
      data-file-id={props.fileId}
      data-testid-file={`mock-codemirror-${props.fileId || 'unknown'}`}
    >
      <span>CodeMirror File: {props.filePath}</span>
      <pre>{props.value}</pre>
    </div>
  ),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  );
}

describe('Split Editor Panes & Detached PDF Preview (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ editorMode: 'code', showEditorTabs: true });
    useLayoutStore.setState({
      editorSplitMode: 'none',
      editorSplitRatio: 0.5,
      activeEditorPane: 'primary',
      secondaryFileId: null,
      isPdfDetached: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Split Editor Panes Architecture', () => {
    it('renders single primary EditorPane when editorSplitMode is "none"', () => {
      renderWithProviders(<EditorArea />);

      expect(document.querySelector('[data-file-id="doc-main"], [data-file-id="doc-1"]')).toBeInTheDocument();
      expect(document.querySelector('[data-file-id="doc-bib"]')).toBeNull();
      // Split button is visible on the single pane toolbar
      expect(screen.getByTitle(/chia đôi khung soạn thảo/i)).toBeInTheDocument();
    });

    it('renders dual EditorPanes with ResizablePanelGroup when editorSplitMode is "vertical"', () => {
      useLayoutStore.setState({
        editorSplitMode: 'vertical',
        secondaryFileId: 'doc-bib',
      });

      renderWithProviders(<EditorArea />);

      // Both primary (main.tex) and secondary (ref.bib) surfaces are rendered simultaneously
      expect(document.querySelector('[data-file-id="doc-main"], [data-file-id="doc-1"]')).toBeInTheDocument();
      expect(document.querySelector('[data-file-id="doc-bib"]')).toBeInTheDocument();

      // Both pane headers are visible with tags
      expect(screen.getByText(/primary/i)).toBeInTheDocument();
      expect(screen.getByText(/secondary/i)).toBeInTheDocument();
    });

    it('dispatches editor:close-split when clicking close on secondary pane', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      useLayoutStore.setState({
        editorSplitMode: 'vertical',
        secondaryFileId: 'doc-bib',
      });

      renderWithProviders(<EditorArea />);

      const closeButtons = screen.getAllByTitle(/đóng khung soạn thảo này/i);
      expect(closeButtons.length).toBeGreaterThan(0);
      fireEvent.click(closeButtons[0]);

      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'editor:close-split' });
    });

    it('dispatches editor:swap-panes when clicking swap button', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      useLayoutStore.setState({
        editorSplitMode: 'vertical',
        secondaryFileId: 'doc-bib',
      });

      renderWithProviders(<EditorArea />);

      const swapButtons = screen.getAllByTitle(/đổi vị trí 2 khung soạn thảo/i);
      expect(swapButtons.length).toBeGreaterThan(0);
      fireEvent.click(swapButtons[0]);

      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'editor:swap-panes' });
    });
  });

  describe('Detached / Pop-out PDF Preview Architecture', () => {
    it('dispatches preview:detach when clicking Pop-out button on PdfToolbar', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      renderWithProviders(
        <PdfToolbar
          compileStatus="idle"
          onCompile={vi.fn()}
          scale={1}
          autoFit={true}
          onToggleAutoFit={vi.fn()}
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          pageNumber={1}
          numPages={1}
          onPrevPage={vi.fn()}
          onNextPage={vi.fn()}
        />
      );

      const popoutBtn = screen.getByLabelText(/mở pdf ra cửa sổ riêng biệt/i);
      expect(popoutBtn).toBeInTheDocument();
      fireEvent.click(popoutBtn);

      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'preview:detach' });
    });

    it('updates isPdfDetached in useLayoutStore when toggled', () => {
      expect(useLayoutStore.getState().isPdfDetached).toBe(false);

      useLayoutStore.getState().setPdfDetached(true);
      expect(useLayoutStore.getState().isPdfDetached).toBe(true);

      useLayoutStore.getState().togglePdfDetached();
      expect(useLayoutStore.getState().isPdfDetached).toBe(false);
    });
  });
});
