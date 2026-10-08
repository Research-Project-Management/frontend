import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import CitationPickerModal from '@/features/editor/ui/modals/CitationPickerModal';
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
    useQuery: vi.fn().mockReturnValue({
      data: [
        { id: 'bib-1', title: 'references.bib', name: 'references.bib', content: '@article{existingKey,\n  title={Existing}\n}' },
      ],
    }),
  };
});

vi.mock('@/features/editor/ui/hooks/use-citation', () => ({
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

import { usePageStore } from '@/features/editor/store';

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

    expect(screen.getByPlaceholderText(/Tìm theo tên tác giả/i)).toBeDefined();
    expect(screen.getByText('@nguyen2024ai')).toBeDefined();
    expect(screen.getByText('Trí tuệ nhân tạo trong tiếng Việt')).toBeDefined();
  });

  it('inserts citation into editor and auto-syncs BibTeX into references.bib (Overleaf Parity)', async () => {
    const notifySpy = vi.spyOn(sessionCoordinator, 'notifyContentChange').mockImplementation(() => {});
    const onOpenChange = vi.fn();

    render(<CitationPickerModal open={true} onOpenChange={onOpenChange} />);

    // Click on the citation item
    const itemRow = screen.getByText('@nguyen2024ai').closest('[data-slot="command-item"]') || screen.getByText('@nguyen2024ai');
    fireEvent.click(itemRow);

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
    render(<CitationPickerModal open={true} onOpenChange={onOpenChange} />);

    // Select \citep
    const citepBtn = screen.getByRole('button', { name: '\\citep' });
    fireEvent.click(citepBtn);

    const itemRow = screen.getByText('@nguyen2024ai');
    fireEvent.click(itemRow);

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

    const dom = tooltip!.create().dom;
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
