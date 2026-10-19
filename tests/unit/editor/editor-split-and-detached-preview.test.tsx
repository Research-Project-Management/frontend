import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { EditorArea } from '@/features/editor/ui/editor/EditorArea';
import { PdfToolbar, DetachedPdfPlaceholder } from '@/features/editor/subsystems/compiler';
import { WorkbenchShell } from '@/features/editor/core/shell/WorkbenchShell';
import { editorCommandBus, setActiveEditorEngine } from '@/features/editor/core';
import { useSettingsStore } from '@/features/editor/core';
import { usePageStore } from '@/features/editor/core';
import { useWorkspaceStore } from '@/features/editor/core';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'test-proj', pageId: 'doc-main' }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/projects/test-proj',
}));

vi.mock('@/features/editor/ui/hooks/useActiveDocument', () => {
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
vi.mock('@/features/editor/ui/editor/CodeMirrorView', () => ({
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
    useWorkspaceStore.setState({
      editorSplitMode: 'none',
      editorSplitRatio: 0.5,
      activeEditorPane: 'primary',
      secondaryFileId: null,
      isPdfDetached: false,
    });
  });

  afterEach(() => {
    cleanup();
    useWorkspaceStore.setState({
      editorSplitMode: 'none',
      secondaryFileId: null,
      isPdfDetached: false,
      activeEditorPane: 'primary',
    });
  });

  describe('Split Editor Panes Architecture', () => {
    it('renders single primary EditorPane when editorSplitMode is "none"', () => {
      renderWithProviders(<EditorArea />);

      expect(document.querySelector('[data-file-id="doc-main"], [data-file-id="doc-1"]')).toBeInTheDocument();
      expect(document.querySelector('[data-file-id="doc-bib"]')).toBeNull();
      // Split button is visible on the single pane toolbar
      expect(screen.getByTitle(/split editor right/i)).toBeInTheDocument();
    });

    it('renders dual EditorPanes with ResizablePanelGroup when editorSplitMode is "vertical"', () => {
      useWorkspaceStore.setState({
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
      useWorkspaceStore.setState({
        editorSplitMode: 'vertical',
        secondaryFileId: 'doc-bib',
      });

      renderWithProviders(<EditorArea />);

      const closeButtons = screen.getAllByTitle(/close split pane/i);
      expect(closeButtons.length).toBeGreaterThan(0);
      fireEvent.click(closeButtons[0]);

      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'editor:close-split' });
    });

    it('dispatches editor:swap-panes when clicking swap button', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      useWorkspaceStore.setState({
        editorSplitMode: 'vertical',
        secondaryFileId: 'doc-bib',
      });

      renderWithProviders(<EditorArea />);

      const swapButtons = screen.getAllByTitle(/swap split panes/i);
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

      const popoutBtn = screen.getByLabelText(/open pdf in separate window/i);
      expect(popoutBtn).toBeInTheDocument();
      fireEvent.click(popoutBtn);

      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'preview:detach' });
    });

    it('updates isPdfDetached in useWorkspaceStore when toggled', () => {
      expect(useWorkspaceStore.getState().isPdfDetached).toBe(false);

      useWorkspaceStore.getState().setPdfDetached(true);
      expect(useWorkspaceStore.getState().isPdfDetached).toBe(true);

      useWorkspaceStore.getState().togglePdfDetached();
      expect(useWorkspaceStore.getState().isPdfDetached).toBe(false);
    });

    it('renders DetachedPdfPlaceholder with re-attach button and dispatches preview:attach on click', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      renderWithProviders(<DetachedPdfPlaceholder />);

      expect(screen.getByText(/pdf is open in a separate window/i)).toBeInTheDocument();
      const reattachBtn = screen.getByRole('button', { name: /re-attach pdf/i });
      expect(reattachBtn).toBeInTheDocument();

      fireEvent.click(reattachBtn);
      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'preview:attach' });
    });

    it('switches layout to editor-only when clicking Full-width editor on DetachedPdfPlaceholder', () => {
      useSettingsStore.setState({ layout: 'split' });
      renderWithProviders(<DetachedPdfPlaceholder />);

      const fullWidthBtn = screen.getByRole('button', { name: /full-width editor/i });
      expect(fullWidthBtn).toBeInTheDocument();

      fireEvent.click(fullWidthBtn);
      expect(useSettingsStore.getState().layout).toBe('editor-only');
    });

    it('allocates 100% flex to editor when preview is absent or null in WorkbenchShell', () => {
      const { container } = render(
        <WorkbenchShell
          editor={<div data-testid="test-editor">Editor Content</div>}
          preview={null}
        />
      );

      const editorSection = container.querySelector('section');
      expect(editorSection).toHaveStyle({ flex: '1 1 0%' });
      // Splitter handle should NOT be rendered when preview is null
      expect(container.querySelector('[aria-label*="PDF preview"]')).toBeNull();
    });

    it('allocates 100% flex to preview when editor is absent or null in WorkbenchShell', () => {
      const { container } = render(
        <WorkbenchShell
          editor={null}
          preview={<div data-testid="test-preview">Preview Content</div>}
        />
      );

      const previewSection = container.querySelector('section');
      expect(previewSection).toHaveStyle({ flex: '1 1 0%' });
      // Splitter handle should NOT be rendered when editor is null
      expect(container.querySelector('[aria-label*="PDF preview"]')).toBeNull();
    });
  });
});
