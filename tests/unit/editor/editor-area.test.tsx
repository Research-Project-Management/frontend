import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { EditorArea } from '@/features/editor/ui/features/editor/EditorArea';
import { useSettingsStore } from '@/features/editor/store';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'test-project-123', pageId: 'test-page-456' }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/editor/test-project-123',
}));

// Mock useActiveDocument to supply test manuscript document
vi.mock('@/features/editor/ui/hooks/use-core', () => ({
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
vi.mock('@/features/editor/ui/features/editor/CodeMirrorView', () => ({
  CodeMirrorView: (props: any) => (
    <div data-testid="mock-codemirror-view" data-file-id={props.fileId}>
      <span>CodeMirror Engine Mock</span>
      <pre>{props.value}</pre>
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

  const renderWithTooltip = (ui: React.ReactElement) =>
    render(<TooltipProvider>{ui}</TooltipProvider>);

  it('renders CodeMirrorView when editorMode is "code"', () => {
    renderWithTooltip(<EditorArea />);

    expect(screen.getByTestId('mock-codemirror-view')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Visual/i })).toBeInTheDocument();
    expect(document.querySelector('.visual-editor-surface')).toBeNull();
  });

  it('renders VisualEditorView when editorMode is "visual"', () => {
    useSettingsStore.setState({ editorMode: 'visual' });

    renderWithTooltip(<EditorArea />);

    expect(screen.queryByTestId('mock-codemirror-view')).toBeNull();
    const visualSurface = document.querySelector('.visual-editor-surface');
    expect(visualSurface).toBeInTheDocument();
    expect(visualSurface?.textContent).toContain('Introduction');
  });

  it('switches between CodeMirrorView and VisualEditorView when switching editorMode', () => {
    const { rerender } = renderWithTooltip(<EditorArea />);

    // Initially in Code mode
    expect(screen.getByTestId('mock-codemirror-view')).toBeInTheDocument();

    // Trigger Visual mode via store
    useSettingsStore.getState().setEditorMode('visual');
    rerender(<TooltipProvider><EditorArea /></TooltipProvider>);

    // Now in Visual mode
    expect(screen.queryByTestId('mock-codemirror-view')).toBeNull();
    expect(document.querySelector('.visual-editor-surface')).toBeInTheDocument();

    // Switch back to Code mode
    useSettingsStore.getState().setEditorMode('code');
    rerender(<TooltipProvider><EditorArea /></TooltipProvider>);

    expect(screen.getByTestId('mock-codemirror-view')).toBeInTheDocument();
    expect(document.querySelector('.visual-editor-surface')).toBeNull();
  });
});
