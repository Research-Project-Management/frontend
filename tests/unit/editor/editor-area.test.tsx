import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { EditorArea } from '@/features/editor/ui/editor/EditorArea';
import { useSettingsStore } from '@/features/editor/core';
import { useLayoutStore } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer/model/lru-document-cache';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

vi.mock('@/features/editor/ui/hooks/document.queries', () => ({
  filesQuery: () => ({ queryKey: ['files'], queryFn: vi.fn() }),
  pageQuery: () => ({ queryKey: ['page'], queryFn: vi.fn() }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'test-project-123', pageId: 'test-page-456' }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/editor/test-project-123',
}));

// Mock useActiveDocument to supply test manuscript document
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
    childFiles: [],
  }),
}));

// Mock CodeMirrorView to identify it easily in tests
vi.mock('@/features/editor/ui/editor/CodeMirrorView', () => ({
  CodeMirrorView: (props: any) => (
    <div data-testid="mock-codemirror-view" data-file-id={props.fileId}>
      <span>CodeMirror Engine Mock</span>
      <pre>{props.value}</pre>
    </div>
  ),
}));

// Mock VisualEditorView to prevent TipTap/DOM measurement issues in JSDOM
vi.mock('@/features/editor/ui/editor/VisualEditorView', () => ({
  VisualEditorView: (props: { fileId?: string }) => (
    <div data-testid="mock-visual-view" data-file-id={props.fileId} className="visual-editor-surface">
      <span>Visual Engine Mock</span>
      <span>Introduction</span>
    </div>
  ),
}));

describe('EditorArea - Source vs Visual Mode Integration', () => {
  beforeEach(() => {
    document.body.removeAttribute('data-scroll-locked');
    document.body.style.pointerEvents = '';
    document.querySelectorAll('[aria-hidden]').forEach((el) => {
      el.removeAttribute('aria-hidden');
    });
    useSettingsStore.setState({ editorMode: 'code', showEditorTabs: true });
    useLayoutStore.setState({ editorSplitMode: 'none', secondaryFileId: null, activeEditorPane: 'primary' });
    lruDocumentCache.clear();
    document.execCommand = vi.fn();
  });

  afterEach(() => {
    cleanup();
    document.body.removeAttribute('data-scroll-locked');
    document.body.style.pointerEvents = '';
    document.querySelectorAll('[aria-hidden]').forEach((el) => {
      el.removeAttribute('aria-hidden');
    });
    vi.clearAllMocks();
  });

  const createWrapper = () => {
    const queryClient = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    );
  };

  const renderWithTooltip = (ui: React.ReactElement) =>
    render(ui, { wrapper: createWrapper() });

  it('renders CodeMirrorView when editorMode is "code"', () => {
    renderWithTooltip(<EditorArea />);

    expect(screen.getByTestId('mock-codemirror-view')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Visual/i })).toBeInTheDocument();
  });

  it('preserves CodeMirrorView and applies Visual mode when editorMode is "visual"', () => {
    useSettingsStore.setState({ editorMode: 'visual' });

    renderWithTooltip(<EditorArea />);

    expect(screen.getByTestId('mock-codemirror-view')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Visual/i })).toBeChecked();
  });

  it('switches between Code and Visual modes seamlessly without unmounting CodeMirror', () => {
    const { rerender } = renderWithTooltip(<EditorArea />);

    // Initially in Code/Source mode
    expect(screen.getByTestId('mock-codemirror-view')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /(Source|Code)/i })).toBeChecked();

    // Trigger Visual mode via store
    useSettingsStore.getState().setEditorMode('visual');
    rerender(<EditorArea />);

    // In Visual mode, CodeMirror remains mounted (0ms latency, zero AST loss)
    expect(screen.getByTestId('mock-codemirror-view')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Visual/i })).toBeChecked();

    // Switch back to Code/Source mode
    useSettingsStore.getState().setEditorMode('code');
    rerender(<EditorArea />);

    expect(screen.getByTestId('mock-codemirror-view')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /(Source|Code)/i })).toBeChecked();
  });
});
