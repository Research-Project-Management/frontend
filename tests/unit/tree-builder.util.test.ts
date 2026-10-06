import { describe, it, expect } from 'vitest';
import {
  inferResearchFolder,
  getRootFilePriority,
  getFolderPriority,
  buildFileTree,
  filterFileTree,
  type FileTreeFileNode,
} from '@/features/editor/components/sidebar/explorer/tree-builder.util';

describe('tree-builder.util', () => {
  describe('inferResearchFolder', () => {
    it('does not categorize main documents or preamble into subfolders', () => {
      expect(inferResearchFolder('main.tex')).toBeNull();
      expect(inferResearchFolder('preamble.tex')).toBeNull();
      expect(inferResearchFolder('references.bib')).toBeNull();
      expect(inferResearchFolder('custom_main.tex', 'custom_main.tex')).toBeNull();
      expect(inferResearchFolder('paper_title.tex', null, 'paper_title.tex')).toBeNull();
    });

    it('infers standard academic folders correctly', () => {
      expect(inferResearchFolder('01_intro.tex')).toBe('sections');
      expect(inferResearchFolder('methodology.tex')).toBe('sections');
      expect(inferResearchFolder('conclusion.tex')).toBe('sections');
      expect(inferResearchFolder('table_results.tex')).toBe('tables');
      expect(inferResearchFolder('alg_optimization.tex')).toBe('algorithms');
      expect(inferResearchFolder('appendix_proofs.tex')).toBe('appendices');
      expect(inferResearchFolder('macros.tex')).toBe('macros');
      expect(inferResearchFolder('custom.sty')).toBe('styles');
      expect(inferResearchFolder('fig1.png')).toBe('figures');
      expect(inferResearchFolder('beamer_slides.tex')).toBe('supplementary');
    });

    it('returns null for unclassified files', () => {
      expect(inferResearchFolder('readme.md')).toBeNull();
      expect(inferResearchFolder('notes.txt')).toBeNull();
    });
  });

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
    });

    it('sorts folder priorities following academic conventions', () => {
      expect(getFolderPriority('sections')).toBeLessThan(getFolderPriority('figures'));
      expect(getFolderPriority('figures')).toBeLessThan(getFolderPriority('tables'));
      expect(getFolderPriority('tables')).toBeLessThan(getFolderPriority('algorithms'));
      expect(getFolderPriority('algorithms')).toBeLessThan(getFolderPriority('appendices'));
    });
  });

  describe('buildFileTree', () => {
    it('builds unified tree with root files and structured folders', () => {
      const files = [
        { id: '1', title: '01_intro.tex' },
        { id: '2', title: 'main.tex' },
      ];
      const projectFiles = [
        { id: 'img-1', filename: 'architecture.png', isFolder: false, size: 1024 },
        { id: 'f-1', filename: 'custom_folder', isFolder: true },
      ];

      const tree = buildFileTree({
        files,
        projectFiles,
        parentPage: { id: 'root', title: 'main.tex' },
        mainFileId: '2',
      });

      expect(tree.length).toBeGreaterThan(0);
      const rootFiles = tree.filter((n) => n.type === 'file');
      const folders = tree.filter((n) => n.type === 'folder');

      expect(rootFiles.some((f) => f.displayLabel === 'main.tex')).toBe(true);
      expect(folders.some((f) => f.name === 'sections')).toBe(true);
      expect(folders.some((f) => f.name === 'figures')).toBe(true);
      expect(folders.some((f) => f.name === 'custom_folder')).toBe(true);
    });
  });

  describe('filterFileTree', () => {
    it('filters files and retains parent folder structures for matches', () => {
      const tree = buildFileTree({
        files: [
          { id: '1', title: '01_intro.tex' },
          { id: '2', title: '02_method.tex' },
          { id: '3', title: 'main.tex' },
        ],
      });

      const filtered = filterFileTree(tree, 'intro');
      expect(filtered.length).toBe(1);
      expect(filtered[0].type).toBe('folder');
      if (filtered[0].type === 'folder') {
        expect(filtered[0].children.length).toBe(1);
        expect(filtered[0].children[0].title).toBe('01_intro.tex');
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
