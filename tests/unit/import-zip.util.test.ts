import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  isZipFile,
  sanitizeZipPath,
  isSystemNoise,
  detectCommonRootPrefix,
  isTextFile,
  parseZipArchive,
} from '@/features/editor/utils/import-zip.util';

describe('import-zip.util', () => {
  describe('isZipFile', () => {
    it('identifies filenames with .zip extension', () => {
      expect(isZipFile('project.zip')).toBe(true);
      expect(isZipFile('PROJECT.ZIP')).toBe(true);
      expect(isZipFile('/path/to/archive.zip?download=1')).toBe(true);
      expect(isZipFile('document.tex')).toBe(false);
      expect(isZipFile('figures.tar.gz')).toBe(false);
    });

    it('identifies File objects by name or type', () => {
      const zipFile = new File(['dummy'], 'paper.zip', { type: 'application/zip' });
      const genericZip = new File(['dummy'], 'archive.dat', { type: 'application/x-zip-compressed' });
      const texFile = new File(['dummy'], 'main.tex', { type: 'text/x-tex' });

      expect(isZipFile(zipFile)).toBe(true);
      expect(isZipFile(genericZip)).toBe(true);
      expect(isZipFile(texFile)).toBe(false);
    });
  });

  describe('sanitizeZipPath', () => {
    it('normalizes backslashes to forward slashes and trims', () => {
      expect(sanitizeZipPath('sections\\intro.tex')).toBe('sections/intro.tex');
      expect(sanitizeZipPath('/root/folder/file.tex/')).toBe('root/folder/file.tex');
      expect(sanitizeZipPath('   figures/plot.png   ')).toBe('figures/plot.png');
    });
  });

  describe('isSystemNoise', () => {
    it('detects macOS and Windows system noise', () => {
      expect(isSystemNoise('__MACOSX/._main.tex')).toBe(true);
      expect(isSystemNoise('project/__MACOSX/image.png')).toBe(true);
      expect(isSystemNoise('.DS_Store')).toBe(true);
      expect(isSystemNoise('sections/.DS_Store')).toBe(true);
      expect(isSystemNoise('Thumbs.db')).toBe(true);
      expect(isSystemNoise('desktop.ini')).toBe(true);
      expect(isSystemNoise('sections/._intro.tex')).toBe(true);
      expect(isSystemNoise('.git/config')).toBe(true);

      // Legitimate project files
      expect(isSystemNoise('main.tex')).toBe(false);
      expect(isSystemNoise('figures/chart.png')).toBe(false);
      expect(isSystemNoise('references.bib')).toBe(false);
    });
  });

  describe('detectCommonRootPrefix', () => {
    it('detects single top-level directory wrapper', () => {
      const paths = [
        'overleaf-export/main.tex',
        'overleaf-export/sections/intro.tex',
        'overleaf-export/figures/fig1.png',
      ];
      expect(detectCommonRootPrefix(paths)).toBe('overleaf-export/');
    });

    it('returns empty string when files are already at root level', () => {
      const paths = [
        'main.tex',
        'sections/intro.tex',
        'figures/fig1.png',
      ];
      expect(detectCommonRootPrefix(paths)).toBe('');
    });

    it('ignores system noise when determining common root', () => {
      const paths = [
        '__MACOSX/._main.tex',
        'my-project/main.tex',
        'my-project/ref.bib',
      ];
      expect(detectCommonRootPrefix(paths)).toBe('my-project/');
    });
  });

  describe('isTextFile', () => {
    it('identifies LaTeX text extensions correctly', () => {
      expect(isTextFile('main.tex')).toBe(true);
      expect(isTextFile('ref.bib')).toBe(true);
      expect(isTextFile('custom.sty')).toBe(true);
      expect(isTextFile('ieee.cls')).toBe(true);
      expect(isTextFile('figure.png')).toBe(false);
      expect(isTextFile('diagram.pdf')).toBe(false);
    });
  });

  describe('parseZipArchive', () => {
    it('unpacks ZIP archive, strips noise, and identifies main.tex', async () => {
      const zip = new JSZip();
      zip.file('main.tex', '\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}');
      zip.file('sections/intro.tex', 'Introduction section content.');
      zip.file('refs.bib', '@article{test2026, author={Flux Team}}');
      zip.file('figures/chart.png', new Uint8Array([137, 80, 78, 71])); // PNG magic
      zip.file('__MACOSX/._main.tex', 'corrupted resource fork');
      zip.file('.DS_Store', 'binary ds store');

      const blob = await zip.generateAsync({ type: 'blob' });
      const file = new File([blob], 'sample-paper.zip', { type: 'application/zip' });

      const parsed = await parseZipArchive(file);

      expect(parsed.name).toBe('sample-paper');
      expect(parsed.mainFilePath).toBe('main.tex');
      expect(parsed.totalFiles).toBe(4); // main.tex, sections/intro.tex, refs.bib, figures/chart.png

      expect(parsed.textFiles).toHaveLength(3);
      expect(parsed.assetFiles).toHaveLength(1);

      const intro = parsed.textFiles.find((f) => f.path === 'sections/intro.tex');
      expect(intro).toBeDefined();
      expect(intro?.textContent).toBe('Introduction section content.');
      expect(intro?.folderPath).toBe('sections');

      const chart = parsed.assetFiles.find((f) => f.path === 'figures/chart.png');
      expect(chart).toBeDefined();
      expect(chart?.isText).toBe(false);
      expect(chart?.blob).toBeDefined();
    });

    it('strips common root wrapper folder and finds document with documentclass', async () => {
      const zip = new JSZip();
      zip.file('project-bundle/paper.tex', '\\documentclass{report}\n\\begin{document}\nThesis\n\\end{document}');
      zip.file('project-bundle/appendix.tex', 'Appendix details');

      const blob = await zip.generateAsync({ type: 'blob' });
      const file = new File([blob], 'project-bundle.zip', { type: 'application/zip' });

      const parsed = await parseZipArchive(file);

      // Wrapper project-bundle/ stripped
      expect(parsed.mainFilePath).toBe('paper.tex');
      expect(parsed.items.map((i) => i.path)).toContain('paper.tex');
      expect(parsed.items.map((i) => i.path)).toContain('appendix.tex');
    });
  });
});
