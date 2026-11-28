import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  getRootFilePriority,
  buildFileTree,
  filterFileTree,
  flattenVisibleTree,
  findAncestorFolderPaths,
  TexFileRow,
  FileTreeFolderRow,
  type FileTreeFileNode,
} from '@/features/editor/subsystems/explorer';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import { normalizeVirtualPath } from '@/features/editor/domain/document/document-naming';
import { newFileModalSchema } from '@/features/editor/domain/types/forms.types';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

describe('Explorer Document Tree (Path-Trie Builder, Virtual Windowing & Tree Rows)', () => {
  afterEach(() => {
    cleanup();
    diagnosticsCoordinator.clear();
  });

  describe('1. Sorting Priorities & Path-Trie Construction', () => {
    it('assigns highest priority to designated main document', () => {
      const mainNode: FileTreeFileNode = {
        type: 'file',
        id: 'file-1',
        title: 'main.tex',
        displayLabel: 'main.tex',
        kind: 'tex',
      };
      const preambleNode: FileTreeFileNode = {
        type: 'file',
        id: 'file-2',
        title: 'preamble.tex',
        displayLabel: 'preamble.tex',
        kind: 'tex',
      };
      const randomNode: FileTreeFileNode = {
        type: 'file',
        id: 'file-3',
        title: 'notes.tex',
        displayLabel: 'notes.tex',
        kind: 'tex',
      };

      expect(getRootFilePriority(mainNode, 'file-1')).toBe(1);
      expect(getRootFilePriority(preambleNode, 'file-1')).toBe(2);
      expect(getRootFilePriority(randomNode, 'file-1')).toBe(10);
      expect(getRootFilePriority(randomNode, 'file-3', null, 'file-1')).toBe(1);
      expect(getRootFilePriority(mainNode, 'file-3', null, 'file-1')).toBe(10);
    });

    it('places root files at root and path-prefixed files into exact nested folders', () => {
      const tree = buildFileTree({
        files: [
          { id: '1', title: 'sections/01_intro.tex' },
          { id: '2', title: 'main.tex' },
          { id: '3', title: '02_flat_at_root.tex' },
        ],
        projectFiles: [
          {
            id: 'img-1',
            filename: 'architecture.png',
            path: 'figures/architecture.png',
            isFolder: false,
            size: 1024,
          },
          { id: 'img-root', filename: 'fig_root.png', isFolder: false, size: 512 },
          { id: 'f-1', filename: 'custom_folder', isFolder: true },
        ],
        parentPage: { id: 'root', title: 'main.tex' },
        mainFileId: '2',
      });

      const rootFiles = tree.filter((n): n is FileTreeFileNode => n.type === 'file');
      const folders = tree.filter((n) => n.type === 'folder');

      expect(rootFiles.map((f) => f.displayLabel)).toEqual([
        'main.tex',
        '02_flat_at_root.tex',
        'fig_root.png',
      ]);
      expect(folders.map((f) => f.name)).toEqual(['custom_folder', 'figures', 'sections']);
    });

    it('supports nested folder chains and single-source DOC/FILE/FOLDER nodes with 3-tier hierarchy', () => {
      const projectFiles = [
        {
          id: 'node-root-doc',
          nodeId: 'node-root-doc',
          docId: 'doc-main-1',
          filename: 'main.tex',
          path: '/main.tex',
          isFolder: false,
          nodeType: 'DOC' as const,
          isRootDoc: true,
          parentId: 'page-manuscript-1',
        },
        {
          id: 'folder-figs',
          nodeId: 'folder-figs',
          filename: 'figures',
          isFolder: true,
          nodeType: 'FOLDER' as const,
          parentId: 'proj-group-1',
        },
        {
          id: 'asset-plot',
          nodeId: 'asset-plot',
          fileId: 'file-plot-1',
          filename: 'plot.png',
          isFolder: false,
          nodeType: 'FILE' as const,
          parentId: 'folder-figs',
          size: 1024,
        },
      ];

      const tree = buildFileTree({
        projectFiles,
        projectId: 'proj-group-1',
        parentPageId: 'page-manuscript-1',
        parentPage: { id: 'page-manuscript-1', title: 'main.tex', projectId: 'proj-group-1' },
      });

      const rootDoc = tree.find((n) => n.type === 'file' && n.id === 'doc-main-1') as
        | FileTreeFileNode
        | undefined;
      expect(rootDoc).toMatchObject({
        pageId: 'page-manuscript-1',
        projectId: 'proj-group-1',
        nodeId: 'node-root-doc',
        isRootDoc: true,
      });

      const figsFolder = tree.find((n) => n.type === 'folder' && n.name === 'figures');
      expect(figsFolder).toBeDefined();
      if (figsFolder && figsFolder.type === 'folder') {
        expect(figsFolder.fullPath).toBe('figures');
        expect(figsFolder.pageId).toBe('page-manuscript-1');
        expect(figsFolder.children[0]).toMatchObject({
          title: 'figures/plot.png',
          kind: 'asset',
          pageId: 'page-manuscript-1',
          projectId: 'proj-group-1',
        });
      }
    });

    it('preserves case-sensitive paths, prevents binary FILE misclassification, and prioritizes authoritative isRootDoc', () => {
      const tree = buildFileTree({
        files: [
          { id: 'node-fig', title: 'figures/plot.png' },
        ],
        projectFiles: [
          {
            id: 'node-paper',
            docId: 'doc-paper',
            filename: 'paper.tex',
            path: '/paper.tex',
            isFolder: false,
            nodeType: 'DOC' as const,
            isRootDoc: true,
          },
          {
            id: 'node-sub-main',
            docId: 'doc-sub-main',
            filename: 'main.tex',
            path: '/subproject/main.tex',
            isFolder: false,
            nodeType: 'DOC' as const,
            isRootDoc: false,
          },
          {
            id: 'node-lower',
            docId: 'doc-lower',
            filename: 'readme.tex',
            path: '/readme.tex',
            isFolder: false,
            nodeType: 'DOC' as const,
          },
          {
            id: 'node-upper',
            docId: 'doc-upper',
            filename: 'README.tex',
            path: '/README.tex',
            isFolder: false,
            nodeType: 'DOC' as const,
          },
          {
            id: 'node-fig',
            fileId: 'blob-fig',
            filename: 'plot.png',
            path: '/figures/plot.png',
            isFolder: false,
            nodeType: 'FILE' as const,
            size: 4096,
            url: '/api/v1/pages/spaces/p1/files/blob-fig',
          },
        ],
        configuredMainFile: 'main.tex',
      });

      const rootFiles = tree.filter((n): n is FileTreeFileNode => n.type === 'file');
      expect(rootFiles.map((f) => f.displayLabel)).toContain('readme.tex');
      expect(rootFiles.map((f) => f.displayLabel)).toContain('README.tex');
      expect(rootFiles.find((f) => f.id === 'doc-paper')?.isRootDoc).toBe(true);

      const figsFolder = tree.find((n) => n.type === 'folder' && n.name === 'figures');
      if (figsFolder && figsFolder.type === 'folder') {
        expect(figsFolder.children[0]).toMatchObject({ id: 'node-fig', kind: 'asset' });
      }
    });
  });

  describe('2. Filtering, Virtual Flattening, Auto-Reveal & Path Validation', () => {
    it('filters tree retaining ancestor folders, flattens expanded folders by depth, and resolves ancestor paths', () => {
      const tree = buildFileTree({
        files: [
          { id: 'doc-main', title: 'main.tex' },
          { id: 'doc-intro', title: 'sections/01_intro.tex' },
          { id: 'doc-deep', title: 'chapters/part3/theorem1.tex' },
        ],
        projectFiles: [
          {
            id: 'img-deep',
            filename: 'plot.png',
            path: 'assets/figs/plot.png',
            isFolder: false,
            size: 512,
          },
        ],
      });

      expect(filterFileTree(tree, '')).toHaveLength(tree.length);
      const filtered = filterFileTree(tree, 'intro');
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.type).toBe('folder');

      const collapsed = flattenVisibleTree(tree, () => false);
      expect(collapsed.every((item) => item.depth === 0)).toBe(true);

      const expanded = flattenVisibleTree(tree, (folder) => folder.name === 'sections');
      expect(expanded.some((item) => item.depth === 1)).toBe(true);

      expect(findAncestorFolderPaths(tree, 'doc-deep')).toEqual(['chapters', 'chapters/part3']);
      expect(findAncestorFolderPaths(tree, 'asset:img-deep')).toEqual(['assets', 'assets/figs']);
      expect(findAncestorFolderPaths(tree, 'doc-main')).toEqual([]);
      expect(findAncestorFolderPaths(tree, 'nonexistent')).toEqual([]);
    });

    it('normalizes virtual paths and validates relative POSIX paths in newFileModalSchema', () => {
      expect(normalizeVirtualPath('././a.tex')).toBe('a.tex');
      expect(normalizeVirtualPath('/./sections/intro.tex')).toBe('sections/intro.tex');
      expect(normalizeVirtualPath('.//./v1.0/Makefile/')).toBe('v1.0/Makefile');

      expect(newFileModalSchema.safeParse({ fileName: 'main.tex' }).success).toBe(true);
      expect(newFileModalSchema.safeParse({ fileName: 'sections/intro.tex' }).success).toBe(true);
      expect(newFileModalSchema.safeParse({ fileName: '../secret.tex' }).success).toBe(false);
      expect(newFileModalSchema.safeParse({ fileName: 'sections/../intro.tex' }).success).toBe(false);
      expect(newFileModalSchema.safeParse({ fileName: '/main.tex' }).success).toBe(false);
      expect(newFileModalSchema.safeParse({ fileName: 'bad\\path.tex' }).success).toBe(false);
      expect(newFileModalSchema.safeParse({ fileName: 'bad:name.tex' }).success).toBe(false);
    });
  });

  describe('3. FileTree Row Rendering Invariants (Clean Badge-Free Chrome)', () => {
    it('renders TexFileRow and FileTreeFolderRow without numeric diagnostic badges even when files contain errors', () => {
      diagnosticsCoordinator.ingestCompilerErrors(
        [
          { line: 5, message: 'Syntax error', file: 'main.tex', severity: 'error' },
          { line: 10, message: 'Error in ch1', file: 'chapters/ch1.tex', severity: 'error' },
        ],
        'main.tex',
      );

      act(() => {
        renderWithProviders(
          <>
            <TexFileRow
              file={{ id: 'file-main', title: 'main.tex' }}
              displayLabel="main.tex"
              isActive={false}
              isMain={true}
              isRenaming={false}
              renameValue=""
              isRenamePending={false}
              onFileClick={vi.fn()}
              onStartRename={vi.fn()}
              onRenameChange={vi.fn()}
              onCommitRename={vi.fn()}
              onCancelRename={vi.fn()}
              onDelete={vi.fn()}
              onSetMain={vi.fn()}
            />
            <FileTreeFolderRow
              node={{
                id: 'folder-chapters',
                name: 'chapters',
                fullPath: 'chapters',
                type: 'folder',
                children: [],
              }}
              isExpanded={false}
              onToggle={vi.fn()}
              onMoveItem={vi.fn()}
              onNewFileInFolder={vi.fn()}
              onUploadToFolder={vi.fn()}
            />
          </>,
        );
      });

      expect(screen.queryByTestId('file-error-badge')).toBeNull();
      expect(screen.queryByTestId('file-warning-badge')).toBeNull();
      expect(screen.queryByTestId('folder-error-badge')).toBeNull();
      expect(screen.queryByTestId('folder-warning-badge')).toBeNull();
    });
  });
});
