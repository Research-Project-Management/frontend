import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import {
  FilesTab,
  FileTreeContainer,
  buildFileTree,
  flattenVisibleTree,
  type FileTreeFolderNode,
  type FileTreeNode,
  type FlattenedTreeNode,
} from '@/features/editor/subsystems/explorer';
import { usePageStore, useWorkspaceStore, useSettingsStore } from '@/features/editor/core';
import { EDITOR_STORAGE_KEYS } from '@/features/editor/domain/constants/editor.constants';
import { pageKeys, storageKeys } from '@/features/editor/ui/hooks/document.queries';
import { manuscriptService } from '@/features/editor/sdk/pages.service';
import type { EditorStorageItem } from '@/features/editor/domain/types/storage-item.types';
import type { PageFile } from '@/features/editor/domain/types/core.types';

const origOffsetHeightDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const origOffsetWidthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const origClientHeightDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
const origScrollHeightDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');

function buildLargeFilesFixture() {
  const pageFiles: PageFile[] = [
    { id: 'doc-1', title: 'main.tex', content: '', updatedAt: '2026-01-01T00:00:00Z' },
  ];
  // 50 root-level tex files + a deeply nested collapsed subtree chapters/part3/sec65.tex
  for (let i = 1; i <= 50; i++) {
    pageFiles.push({
      id: `doc-root-${i}`,
      title: `appendix_${String(i).padStart(2, '0')}.tex`,
      content: '',
      updatedAt: '2026-01-01T00:00:00Z',
    });
  }
  for (let i = 51; i <= 79; i++) {
    pageFiles.push({
      id: `doc-sec-${i}`,
      title: `chapters/part3/sec${i}.tex`,
      content: '',
      updatedAt: '2026-01-01T00:00:00Z',
    });
  }
  const storageItems: EditorStorageItem[] = [];
  return { pageFiles, storageItems };
}

function createSeededQueryClient(pageFiles: PageFile[], storageItems: EditorStorageItem[]) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
  qc.setQueryData(pageKeys.files('doc-1'), pageFiles);
  qc.setQueryData(storageKeys.files('doc-1', 'doc-1'), storageItems);
  qc.setQueryData(pageKeys.detail('doc-1'), {
    id: 'doc-1',
    title: 'main.tex',
    projectId: 'proj-123',
    content: '',
  });
  return qc;
}

describe('Virtual File Tree Interactions (Auto-Reveal, Filter, Inline Subfolder Create, Keyboard Nav)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.hasAttribute?.('data-tree-flat-index')) return 30;
        return 480;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.hasAttribute?.('data-tree-flat-index')) return 30;
        return 480;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.hasAttribute?.('data-tree-flat-index')) return 30;
        let maxChildHeight = 480;
        for (let i = 0; i < this.children.length; i++) {
          const child = this.children[i] as HTMLElement | undefined;
          const h = Number.parseFloat(child?.style?.height || '');
          if (Number.isFinite(h) && h > maxChildHeight) {
            maxChildHeight = h;
          }
        }
        return maxChildHeight;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 320,
    });
    Element.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollTo = function (
      options?: ScrollToOptions | number,
      y?: number,
    ) {
      const top = typeof options === 'number' ? (y ?? 0) : (options?.top ?? 0);
      this.scrollTop = top;
      this.dispatchEvent(new Event('scroll'));
    };

    useSettingsStore.setState({ mainFile: 'main.tex', mainBibFile: 'references.bib' });
    useWorkspaceStore.getState().resetLayout();
    usePageStore.setState({
      projectId: 'proj-123',
      spaceId: 'proj-123',
      rootPageId: 'doc-1',
      parentPageId: 'doc-1',
      activePageId: 'doc-1',
      currentPage: {
        id: 'doc-1',
        title: 'main.tex',
        projectId: 'proj-123',
        content: '',
      },
      activeFilePage: {
        id: 'doc-1',
        title: 'main.tex',
        content: '',
      },
    });
  });

  afterEach(() => {
    cleanup();
    if (origOffsetHeightDesc) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origOffsetHeightDesc);
    } else {
      delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
    }
    if (origOffsetWidthDesc) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origOffsetWidthDesc);
    } else {
      delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
    }
    if (origClientHeightDesc) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', origClientHeightDesc);
    } else {
      delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
    }
    if (origScrollHeightDesc) {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', origScrollHeightDesc);
    } else {
      delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
    }
    vi.restoreAllMocks();
  });

  it('auto-expands collapsed ancestor folders and reveals deeply nested active file in virtualized tree', async () => {
    const { pageFiles, storageItems } = buildLargeFilesFixture();
    const qc = createSeededQueryClient(pageFiles, storageItems);

    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <FilesTab />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    // Initially folders are collapsed so part3 / sec65.tex are not in DOM
    expect(screen.queryByRole('button', { name: /Folder part3/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /File sec65\.tex/i })).toBeNull();

    // Activate sec65.tex (nested inside chapters -> part3)
    act(() => {
      usePageStore.setState({
        activeFilePage: {
          id: 'doc-sec-65',
          title: 'chapters/part3/sec65.tex',
          content: '',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Folder chapters/i })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(screen.getByRole('button', { name: /Folder part3/i })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(screen.getByRole('button', { name: /File sec65\.tex/i })).toBeInTheDocument();
    });
  });

  it('toggles toolbar quick file filter, filters nested files, and clears on Escape', async () => {
    const { pageFiles, storageItems } = buildLargeFilesFixture();
    const qc = createSeededQueryClient(pageFiles, storageItems);

    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <FilesTab />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    const filterBtn = screen.getByRole('button', { name: 'Filter files' });
    fireEvent.click(filterBtn);

    const filterInput = screen.getByLabelText('Filter files by name') as HTMLInputElement;
    expect(filterInput).toBeInTheDocument();

    fireEvent.change(filterInput, { target: { value: 'sec65' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /File sec65\.tex/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /File appendix_01\.tex/i })).toBeNull();
    });

    fireEvent.keyDown(filterInput, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByLabelText('Filter files by name')).toBeNull();
      expect(screen.getByRole('button', { name: /File appendix_01\.tex/i })).toBeInTheDocument();
    });
  });

  it('renders inline file creation directly under target folder instead of duplicating at top and prefixes path cleanly', async () => {
    const createSpy = vi
      .spyOn(manuscriptService.docs, 'createChildFile')
      .mockResolvedValue({ id: 'new-lemma', title: 'chapters/part3/lemma.tex', content: '' } as PageFile);

    const { pageFiles, storageItems } = buildLargeFilesFixture();
    const qc = createSeededQueryClient(pageFiles, storageItems);
    localStorage.setItem(
      `${EDITOR_STORAGE_KEYS.EXPANDED_FOLDERS_PREFIX}doc-1`,
      JSON.stringify(['chapters', 'chapters/part3']),
    );

    const { container } = render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <FilesTab />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    // Scroll deep down the virtualized tree to bring chapters/part3 (row 52) into view
    const scrollEl = container.querySelector('.overflow-y-auto') as HTMLElement;
    expect(scrollEl).toBeTruthy();
    act(() => {
      scrollEl.scrollTo({ top: 1500 });
    });

    const part3Row = await screen.findByRole('button', { name: /Folder part3/i });
    const rowContainer = part3Row.closest('[data-tree-flat-index]')!;
    // Open Folder dropdown actions via pointerDown (Radix DropdownMenu convention in jsdom)
    const actionsBtn = rowContainer.querySelector('button[aria-haspopup="menu"]');
    expect(actionsBtn).toBeTruthy();
    fireEvent.pointerDown(actionsBtn!);

    const newInFolderItem = await screen.findByRole('menuitem', { name: /New file in part3/i });
    fireEvent.click(newInFolderItem);

    const inlineInputs = await screen.findAllByPlaceholderText('filename.tex');
    // Exactly 1 inline input, placed directly inside a flattened virtual tree row (not duplicated at top)
    expect(inlineInputs).toHaveLength(1);
    const inputWrapperRow = inlineInputs[0].closest('[data-tree-flat-index]') as HTMLElement;
    expect(inputWrapperRow).toBeTruthy();
    const part3Idx = Number(rowContainer.getAttribute('data-tree-flat-index'));
    expect(Number(inputWrapperRow.getAttribute('data-tree-flat-index'))).toBe(part3Idx + 1);

    fireEvent.change(inlineInputs[0], { target: { value: 'lemma.tex' } });
    fireEvent.keyDown(inlineInputs[0], { key: 'Enter' });

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          parentPageId: 'doc-1',
          title: 'chapters/part3/lemma.tex',
        }),
      );
    });
  });

  it('supports keyboard navigation (ArrowDown, ArrowLeft collapse/jump-parent, ArrowRight expand) across virtualized rows', async () => {
    const files: PageFile[] = [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `alpha-${i}`,
        title: `alpha/child_${i}.tex`,
        content: '',
      })),
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `zeta-${i}`,
        title: `zeta/item_${String(i).padStart(2, '0')}.tex`,
        content: '',
      })),
    ];
    const tree = buildFileTree({ files });

    function TreeHarness() {
      const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(['alpha', 'zeta']));
      const isFolderExpanded = React.useCallback(
        (node: FileTreeFolderNode) => expanded.has(node.fullPath || node.name),
        [expanded],
      );
      const onToggleFolder = React.useCallback((key: string) => {
        setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      }, []);

      const flattenedTree = React.useMemo(
        () => flattenVisibleTree(tree, isFolderExpanded),
        [isFolderExpanded],
      );

      const renderNode = React.useCallback(
        (node: FileTreeNode, depth = 0): React.ReactNode => {
          if (node.type === 'folder') {
            return (
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isFolderExpanded(node)}
                aria-label={`Folder ${node.name}`}
                data-depth={depth}
              >
                {node.name}
              </div>
            );
          }
          return (
            <div role="button" tabIndex={0} aria-label={`File ${node.displayLabel}`} data-depth={depth}>
              {node.displayLabel}
            </div>
          );
        },
        [isFolderExpanded],
      );

      const renderFlatRow = React.useCallback(
        (item: FlattenedTreeNode) => renderNode(item.node, item.depth),
        [renderNode],
      );

      return (
        <FileTreeContainer
          isDragging={false}
          handleDragEnter={vi.fn()}
          handleDragLeave={vi.fn()}
          handleDragOver={vi.fn()}
          handleDrop={vi.fn()}
          handleMoveItem={vi.fn()}
          isCreatingFile={false}
          newFileName=""
          setNewFileName={vi.fn()}
          handleCreateFile={vi.fn()}
          handleCancelCreate={vi.fn()}
          isCreateFilePending={false}
          isCreatingFolder={false}
          newFolderName=""
          setNewFolderName={vi.fn()}
          handleCreateFolder={vi.fn()}
          handleCancelCreateFolder={vi.fn()}
          isCreateFolderPending={false}
          isLoading={false}
          projectFilesLoading={false}
          uploadingCount={0}
          isFilesError={false}
          filesError={null}
          treeItemsLength={files.length}
          displayTree={tree}
          fileFilter=""
          setFileFilter={vi.fn()}
          renderTreeNode={renderNode}
          flattenedTree={flattenedTree}
          renderFlatRow={renderFlatRow}
          isFolderExpanded={isFolderExpanded}
          onToggleFolder={onToggleFolder}
        />
      );
    }

    render(<TreeHarness />);

    const folderBtn = screen.getByRole('button', { name: 'Folder alpha' });
    folderBtn.focus();
    expect(document.activeElement).toBe(folderBtn);

    // ArrowDown -> focuses first child inside alpha
    fireEvent.keyDown(folderBtn, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(document.activeElement?.getAttribute('aria-label')).toBe('File child_0.tex');
    });

    // ArrowLeft from nested child -> jumps focus back up to parent Folder alpha
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Folder alpha' }));
    });

    // ArrowLeft on expanded folder -> collapses alpha
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: 'Folder alpha' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('button', { name: 'File child_0.tex' })).toBeNull();

    // ArrowRight on collapsed folder -> expands alpha
    fireEvent.keyDown(screen.getByRole('button', { name: 'Folder alpha' }), { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Folder alpha' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'File child_0.tex' })).toBeInTheDocument();
  });
});
