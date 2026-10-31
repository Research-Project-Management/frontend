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
});
