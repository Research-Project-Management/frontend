import { describe, it, expect } from 'vitest';
import {
  getRootFilePriority,
  buildFileTree,
  filterFileTree,
  type FileTreeFileNode,
} from '@/features/editor/subsystems/explorer/model/document-tree';

describe('document-tree (1:1 Path-Trie Builder)', () => {
  describe('sorting priorities', () => {
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

      // When another file is designated as main, it becomes priority 1
      expect(getRootFilePriority(randomNode, 'file-3', null, 'file-1')).toBe(1);
      expect(getRootFilePriority(mainNode, 'file-3', null, 'file-1')).toBe(10);
    });
  });

  describe('buildFileTree', () => {
    it('places root files at root (zero synthetic folder hallucination) and path-prefixed files into exact folders', () => {
      const files = [
        { id: '1', title: 'sections/01_intro.tex' },
        { id: '2', title: 'main.tex' },
        { id: '3', title: '02_flat_at_root.tex' },
      ];
      const projectFiles = [
        { id: 'img-1', filename: 'architecture.png', path: 'figures/architecture.png', isFolder: false, size: 1024 },
        { id: 'img-root', filename: 'fig_root.png', isFolder: false, size: 512 },
        { id: 'f-1', filename: 'custom_folder', isFolder: true },
      ];

      const tree = buildFileTree({
        files,
        projectFiles,
        parentPage: { id: 'root', title: 'main.tex' },
        mainFileId: '2',
      });

      const rootFiles = tree.filter((n): n is FileTreeFileNode => n.type === 'file');
      const folders = tree.filter((n) => n.type === 'folder');

      // Root files stay at root unless their path actually contains a folder prefix
      expect(rootFiles.map((f) => f.displayLabel)).toEqual([
        'main.tex',
        '02_flat_at_root.tex',
        'fig_root.png',
      ]);
      expect(folders.map((f) => f.name)).toEqual([
        'custom_folder',
        'figures',
        'sections',
      ]);
    });

    it('preserves nested folder paths and asset full paths via f.path or parentId chain', () => {
      const projectFiles = [
        { id: 'folder-top', filename: 'chapters', path: '/chapters', isFolder: true, parentId: null },
        { id: 'folder-sub', filename: 'part1', path: '/chapters/part1', isFolder: true, parentId: 'folder-top' },
        {
          id: 'asset-nested',
          filename: 'diagram.png',
          path: '/chapters/part1/diagram.png',
          isFolder: false,
          parentId: 'folder-sub',
          size: 2048,
        },
      ];

      const tree = buildFileTree({
        files: [{ id: 'main-1', title: 'main.tex', isRootDoc: true }],
        projectFiles,
      });

      const chaptersFolder = tree.find((n) => n.type === 'folder' && n.name === 'chapters');
      expect(chaptersFolder).toBeDefined();
      if (chaptersFolder && chaptersFolder.type === 'folder') {
        expect(chaptersFolder.id).toBe('folder-top');
        expect(chaptersFolder.fullPath).toBe('chapters');
        const part1Folder = chaptersFolder.children.find((c) => c.type === 'folder' && c.name === 'part1');
        expect(part1Folder).toBeDefined();
        if (part1Folder && part1Folder.type === 'folder') {
          expect(part1Folder.id).toBe('folder-sub');
          expect(part1Folder.fullPath).toBe('chapters/part1');
          const assetNode = part1Folder.children.find((c) => c.type === 'file' && c.id === 'asset-nested');
          expect(assetNode).toBeDefined();
          if (assetNode && assetNode.type === 'file') {
            expect(assetNode.title).toBe('chapters/part1/diagram.png');
            expect(assetNode.displayLabel).toBe('diagram.png');
          }
        }
      }
    });

    it('supports building the full tree from single-source projectFiles containing DOC, FILE, and FOLDER nodes', () => {
      const projectFiles = [
        {
          id: 'node-root',
          docId: 'doc-main',
          filename: 'main.tex',
          path: '/main.tex',
          isFolder: false,
          nodeType: 'DOC' as const,
          isRootDoc: true,
        },
        {
          id: 'node-folder',
          filename: 'sections',
          path: '/sections',
          isFolder: true,
          nodeType: 'FOLDER' as const,
        },
        {
          id: 'node-intro',
          docId: 'doc-intro',
          filename: 'intro.tex',
          path: '/sections/intro.tex',
          isFolder: false,
          nodeType: 'DOC' as const,
          parentId: 'node-folder',
        },
      ];

      const tree = buildFileTree({
        projectFiles,
        parentPage: { id: 'project-root-page', title: 'main.tex' },
      });
      expect(tree).toHaveLength(2);
      expect(tree[0]).toMatchObject({
        type: 'file',
        id: 'doc-main',
        displayLabel: 'main.tex',
        kind: 'tex',
        isRootDoc: true,
      });
      expect(tree[1]).toMatchObject({
        type: 'folder',
        id: 'node-folder',
        name: 'sections',
      });
      if (tree[1]?.type === 'folder') {
        expect(tree[1].children[0]).toMatchObject({
          type: 'file',
          id: 'doc-intro',
          title: 'sections/intro.tex',
          displayLabel: 'intro.tex',
          kind: 'tex',
        });
      }
    });
  });

  describe('filterFileTree', () => {
    it('filters files and retains parent folder structures for matches', () => {
      const tree = buildFileTree({
        files: [
          { id: '1', title: 'sections/01_intro.tex' },
          { id: '2', title: 'sections/02_method.tex' },
          { id: '3', title: 'main.tex' },
        ],
      });

      const filtered = filterFileTree(tree, 'intro');
      expect(filtered.length).toBe(1);
      expect(filtered[0].type).toBe('folder');
      if (filtered[0].type === 'folder') {
        expect(filtered[0].children.length).toBe(1);
        const firstChild = filtered[0].children[0];
        if (firstChild && firstChild.type === 'file') {
          expect(firstChild.title).toBe('sections/01_intro.tex');
        }
      }
    });

    it('returns full tree when filter query is empty', () => {
      const tree = buildFileTree({
        files: [{ id: '1', title: 'main.tex' }],
      });
      expect(filterFileTree(tree, '').length).toBe(tree.length);
    });
  });

  describe('schema & identity invariants (Overleaf/POSIX parity)', () => {
    it('prevents binary FILE assets from being misclassified as TeX documents even if present in files array', () => {
      const files = [
        { id: 'node-main', title: 'main.tex', isRootDoc: true },
        { id: 'node-fig', title: 'figures/plot.png' },
      ];
      const projectFiles = [
        {
          id: 'node-fig',
          fileId: 'blob-fig',
          filename: 'plot.png',
          path: '/figures/plot.png',
          isFolder: false,
          nodeType: 'FILE' as const,
          size: 4096,
          url: '/api/v1/manuscripts/projects/p1/files/blob-fig',
        },
      ];

      const tree = buildFileTree({ files, projectFiles });
      const figuresFolder = tree.find((n) => n.type === 'folder' && n.name === 'figures');
      expect(figuresFolder).toBeDefined();
      if (figuresFolder && figuresFolder.type === 'folder') {
        expect(figuresFolder.children).toHaveLength(1);
        expect(figuresFolder.children[0]).toMatchObject({
          type: 'file',
          id: 'node-fig',
          kind: 'asset',
          displayLabel: 'plot.png',
        });
      }
    });

    it('preserves case-sensitive distinct paths and prioritizes authoritative isRootDoc over nested main.tex', () => {
      const projectFiles = [
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
      ];

      const tree = buildFileTree({
        projectFiles,
        configuredMainFile: 'main.tex',
      });

      const rootFiles = tree.filter((n): n is FileTreeFileNode => n.type === 'file');
      expect(rootFiles.map((f) => f.displayLabel)).toContain('readme.tex');
      expect(rootFiles.map((f) => f.displayLabel)).toContain('README.tex');

      const paperNode = rootFiles.find((f) => f.id === 'doc-paper');
      expect(paperNode?.isRootDoc).toBe(true);

      const subFolder = tree.find((n) => n.type === 'folder' && n.name === 'subproject');
      if (subFolder && subFolder.type === 'folder') {
        const subMain = subFolder.children[0] as FileTreeFileNode;
        expect(subMain.isRootDoc).toBe(false);
      }
    });

    it('propagates 3-tier hierarchy (projectId -> pageId -> nodeId/docId) and treats parentPageId/projectId as root in resolveStoragePath', () => {
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

      const rootDoc = tree.find((n) => n.type === 'file' && n.id === 'doc-main-1') as FileTreeFileNode | undefined;
      expect(rootDoc).toBeDefined();
      expect(rootDoc?.pageId).toBe('page-manuscript-1');
      expect(rootDoc?.projectId).toBe('proj-group-1');
      expect(rootDoc?.nodeId).toBe('node-root-doc');

      const figsFolder = tree.find((n) => n.type === 'folder' && n.name === 'figures');
      expect(figsFolder).toBeDefined();
      if (figsFolder && figsFolder.type === 'folder') {
        expect(figsFolder.pageId).toBe('page-manuscript-1');
        expect(figsFolder.projectId).toBe('proj-group-1');
        expect(figsFolder.fullPath).toBe('figures');
        expect(figsFolder.children).toHaveLength(1);
        const plotAsset = figsFolder.children[0] as FileTreeFileNode;
        expect(plotAsset.title).toBe('figures/plot.png');
        expect(plotAsset.pageId).toBe('page-manuscript-1');
        expect(plotAsset.projectId).toBe('proj-group-1');
      }
    });
  });
});
