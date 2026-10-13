import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import CitationPickerModal from '@/features/editor/ui/modals/citation-picker/CitationPickerModal';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import {
  editorCommandBus,
  setActiveEditorEngine,
} from '@/features/editor/coordinators/command-bus';
import { sessionCoordinator } from '@/features/editor/coordinators/session.coordinator';
import { workspaceCoordinator } from '@/features/editor/coordinators/workspace.coordinator';
import { citationHoverSource } from '@/features/editor/engines/extensions/latex-citation-hover';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// Mock dependencies
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: vi.fn().mockReturnValue({
      invalidateQueries: vi.fn(),
      getQueryData: vi.fn(),
      setQueryData: vi.fn(),
    }),
    useQuery: vi.fn().mockReturnValue({
      data: [
        { id: 'bib-1', title: 'references.bib', name: 'references.bib', content: '@article{existingKey,\n  title={Existing}\n}' },
      ],
    }),
    useMutation: vi.fn().mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  };
});

vi.mock('@/features/library/data/catalog/catalog.queries', () => ({
  useCollections: vi.fn().mockReturnValue({
    collections: [],
    isLoading: false,
    createCollection: vi.fn(),
  }),
}));

vi.mock('@/features/editor/ui/hooks/useCitation', () => ({
  useEditorCitations: vi.fn().mockReturnValue({
    libraryItems: [
      {
        id: 'lib-1',
        citationKey: 'nguyen2024ai',
        title: 'Trí tuệ nhân tạo trong tiếng Việt',
        authors: ['Nguyễn Văn An'],
        year: 2024,
      },
    ],
  }),
}));

import { usePageStore } from '@/features/editor/store/editor.store';

describe('Overleaf Parity: Citation Picker & Reference Workflow', () => {
  let mockEngine: any;

  beforeEach(() => {
    vi.clearAllMocks();
    latexSymbolsIndex.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    usePageStore.setState({
      projectId: 'proj-123',
      currentPage: { id: 'page-1', projectId: 'proj-123' } as any,
      activeFilePage: { id: 'page-1', projectId: 'proj-123' } as any,
    });

    mockEngine = {
      insertText: vi.fn(),
      focus: vi.fn(),
      getContent: vi.fn().mockReturnValue(''),
    };
    setActiveEditorEngine(mockEngine);

    latexSymbolsIndex.setLibraryCitations([
      {
        id: 'lib-1',
        citationKey: 'nguyen2024ai',
        title: 'Trí tuệ nhân tạo trong tiếng Việt',
        authors: [{ fullName: 'Nguyễn Văn An' }],
        year: 2024,
      },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders CitationPickerModal and lists references', async () => {
    const onOpenChange = vi.fn();
    render(<CitationPickerModal open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByPlaceholderText(/Search title, author|Tìm theo tên/i)).toBeDefined();
    expect(screen.getByText('@nguyen2024ai')).toBeDefined();
    expect(screen.getAllByText('Trí tuệ nhân tạo trong tiếng Việt').length).toBeGreaterThan(0);
  });

  it('inserts citation into editor and auto-syncs BibTeX into references.bib (Overleaf Parity)', async () => {
    const notifySpy = vi.spyOn(sessionCoordinator, 'notifyContentChange').mockImplementation(() => {});
    const onOpenChange = vi.fn();

    render(<CitationPickerModal open={true} onOpenChange={onOpenChange} />);

    // Double-click on the citation card to insert
    const card = screen.getByRole('option', { name: /Trí tuệ nhân tạo trong tiếng Việt/i });
    fireEvent.doubleClick(card);

    // Verify citation macro inserted into editor
    expect(mockEngine.insertText).toHaveBeenCalledWith('\\cite{nguyen2024ai}');
    expect(mockEngine.focus).toHaveBeenCalled();

    // Verify Overleaf parity: BibTeX entry is automatically appended into references.bib
    await waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith(
        'bib-1',
        expect.stringContaining('@article{nguyen2024ai,')
      );
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('switches citation styles (\\citep, \\citet, [@key]) prior to insertion', async () => {
    const onOpenChange = vi.fn();
    render(<CitationPickerModal open={true} onOpenChange={onOpenChange} defaultStyle="latex-citep" />);

    const card = screen.getByRole('option', { name: /Trí tuệ nhân tạo trong tiếng Việt/i });
    fireEvent.doubleClick(card);

    expect(mockEngine.insertText).toHaveBeenCalledWith('\\citep{nguyen2024ai}');
  });

  it('allows jumping to definition in .bib file from hover tooltip (Overleaf parity)', () => {
    // Add entry with project .bib as sourceFile
    latexSymbolsIndex.indexFile(
      'file-bib-1',
      'references.bib',
      `@article{knuth1984,
  title = {Literate Programming},
  author = {Donald E. Knuth},
  year = {1984},
  journal = {The Computer Journal}
}`
    );

    const doc = 'Thuật toán theo nghiên cứu của \\cite{knuth1984}.';
    const state = EditorState.create({ doc });
    const view = new EditorView({ state });

    const pos = doc.indexOf('knuth1984') + 2;
    const tooltip = citationHoverSource(view, pos, 1);
    expect(tooltip).not.toBeNull();

    const dom = tooltip!.create(view).dom;
    expect(dom.textContent).toContain('@knuth1984');
    expect(dom.textContent).toContain('Literate Programming');

    // Check jump-to-file button
    const jumpBtn = dom.querySelector('button[title*="references.bib"]');
    expect(jumpBtn).not.toBeNull();

    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
    (jumpBtn as HTMLElement).click();

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'workspace:open-file',
      fileId: 'references.bib',
      filePath: 'references.bib',
    });

    view.destroy();
  });
});
