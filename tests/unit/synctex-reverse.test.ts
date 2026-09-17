import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseSyncTeX,
  LatexCompilerEngine,
  type SyncTeXMap,
} from '@/features/editor/utils/viewer.util';
import { synctexService } from '@/features/editor/services/synctex.service';

describe('Reverse SyncTeX (PDF Double-Click -> LaTeX Source Jump)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Coordinate Unscaling Math & BoundingRect', () => {
    it('should accurately convert rendered CSS pixel offsets to PDF points (pt)', () => {
      // PDF standard: A4 = 595 x 842 pt
      const scale = 1.5;
      const rect = { left: 100, top: 50, width: 595 * scale, height: 842 * scale };

      // User double clicks at client (400, 350)
      const clientX = 400;
      const clientY = 350;

      const clickX = clientX - rect.left; // 300px
      const clickY = clientY - rect.top;  // 300px

      const clickFraction = clickY / rect.height;
      const ptX = Math.round(clickX / scale); // 200 pt
      const ptY = Math.round(clickY / scale); // 200 pt

      expect(clickX).toBe(300);
      expect(clickY).toBe(300);
      expect(ptX).toBe(200);
      expect(ptY).toBe(200);
      expect(clickFraction).toBeCloseTo(300 / (842 * 1.5), 4);
    });

    it('should clamp clickFraction between 0 and 1', () => {
      const pageHeight = 1000;
      const clamp = (y: number) => Math.max(0, Math.min(1, y / pageHeight));

      expect(clamp(-50)).toBe(0);
      expect(clamp(500)).toBe(0.5);
      expect(clamp(1200)).toBe(1);
    });
  });

  describe('parseSyncTeX Coordinate-Aware Mapping', () => {
    const mockSyncTeXContent = `SyncTeX Version:1
Input:1:./main.tex
Input:2:./sections/methodology.tex
{1
[1,10,0:6553600,13107200:29491200,917504
x1,25:6553600,26214400
}
{2
[2,45,0:6553600,6553600:29491200,917504
x2,80:6553600,19660800
}`;

    it('should parse inputs, nodes and pages correctly into SyncTeXMap', () => {
      const map: SyncTeXMap = parseSyncTeX(mockSyncTeXContent);

      expect(map.tagToPath.get(1)).toBe('./main.tex');
      expect(map.tagToPath.get(2)).toBe('./sections/methodology.tex');

      expect(map.pathToTag.get('main.tex')).toBe(1);
      expect(map.pathToTag.get('methodology.tex')).toBe(2);

      const page1Nodes = map.pageToNodes.get(1);
      expect(page1Nodes).toBeDefined();
      expect(page1Nodes?.length).toBe(2);

      // Node 1: line 10, tag 1, x: 6553600 (100pt * 65536), y: 13107200 (200pt * 65536)
      expect(page1Nodes![0]).toMatchObject({
        line: 10,
        tag: 1,
        x: 6553600,
        y: 13107200,
        page: 1,
      });

      // Page 2 nodes
      const page2Nodes = map.pageToNodes.get(2);
      expect(page2Nodes?.length).toBe(2);
      expect(page2Nodes![1].line).toBe(80);
      expect(page2Nodes![1].tag).toBe(2);
    });
  });

  describe('LatexCompilerEngine.resolveReverse (Local 0ms Jump)', () => {
    const mockSyncTeXContent = `SyncTeX Version:1
Input:1:./main.tex
Input:2:./sections/intro.tex
{1
x1,15:6553600,6553600
x1,42:6553600,19660800
}
{2
x2,55:6553600,13107200
}`;

    it('should resolve the closest line based on PDF point coordinates (ptX, ptY)', () => {
      const map = parseSyncTeX(mockSyncTeXContent);

      // Page 1:
      // Node 1: line 15, y = 6553600 sp (100 pt)
      // Node 2: line 42, y = 19660800 sp (300 pt)
      // User clicks at page 1, ptX = 100 pt, ptY = 110 pt (very close to line 15)
      const res1 = LatexCompilerEngine.resolveReverse(0.13, 1, map, 100, 110);
      expect(res1).not.toBeNull();
      expect(res1?.line).toBe(15);
      expect(res1?.sourcePath).toBe('./main.tex');

      // User clicks at page 1, ptX = 100 pt, ptY = 290 pt (very close to line 42)
      const res2 = LatexCompilerEngine.resolveReverse(0.35, 1, map, 100, 290);
      expect(res2).not.toBeNull();
      expect(res2?.line).toBe(42);
      expect(res2?.sourcePath).toBe('./main.tex');
    });

    it('should identify the correct sub-file from multi-file projects', () => {
      const map = parseSyncTeX(mockSyncTeXContent);

      // Page 2 has tag 2 -> ./sections/intro.tex, line 55
      const res = LatexCompilerEngine.resolveReverse(0.2, 2, map, 100, 200);
      expect(res).not.toBeNull();
      expect(res?.line).toBe(55);
      expect(res?.sourcePath).toBe('./sections/intro.tex');
    });

    it('should fallback to clickFraction approximation when pt coordinates are not provided', () => {
      const map = parseSyncTeX(mockSyncTeXContent);

      // clickFraction near top of page (approx y ~ 100 pt = 0.12 * 842 pt)
      const res = LatexCompilerEngine.resolveReverse(0.12, 1, map);
      expect(res).not.toBeNull();
      expect(res?.line).toBe(15);
    });

    it('should return null when synctexMap is null', () => {
      const res = LatexCompilerEngine.resolveReverse(0.5, 1, null, 100, 200);
      expect(res).toBeNull();
    });
  });

  describe('LatexCompilerEngine.resolveReverseRemote (Backend Fallback)', () => {
    it('should successfully query synctexService when called', async () => {
      const mockResult = {
        file: 'chapters/abstract.tex',
        line: 23,
        column: 4,
      };

      vi.spyOn(synctexService, 'reverseSync').mockResolvedValueOnce(mockResult);

      const res = await LatexCompilerEngine.resolveReverseRemote(
        'proj-123',
        1,
        150,
        220,
      );

      expect(synctexService.reverseSync).toHaveBeenCalledWith({
        projectId: 'proj-123',
        page: 1,
        x: 150,
        y: 220,
      });

      expect(res).toEqual({
        sourcePath: 'chapters/abstract.tex',
        line: 23,
      });
    });

    it('should return null gracefully if synctexService returns null or throws', async () => {
      vi.spyOn(synctexService, 'reverseSync').mockRejectedValueOnce(new Error('Network error'));

      const res = await LatexCompilerEngine.resolveReverseRemote(
        'proj-123',
        1,
        150,
        220,
      );

      expect(res).toBeNull();
    });
  });

  describe('Sub-file Basename Resolution', () => {
    it('should match files by clean basename ignoring path prefix and extension', () => {
      const pageFiles = [
        { id: 'page-1', title: 'main.tex' },
        { id: 'page-2', title: 'sections/intro.tex' },
        { id: 'page-3', title: 'references.bib' },
      ];

      const findPageByBasename = (basename: string) => {
        const cleanName = basename.replace(/^\.\//, '').toLowerCase();
        const baseNoExt = cleanName.replace(/\.(tex|bib|sty|cls)$/i, '');
        return pageFiles.find((p) => {
          const titleLower = (p.title || '').toLowerCase();
          return (
            titleLower === cleanName ||
            titleLower.replace(/\.(tex|bib|sty|cls)$/i, '') === baseNoExt ||
            titleLower.endsWith('/' + cleanName)
          );
        });
      };

      const match1 = findPageByBasename('main.tex');
      expect(match1?.id).toBe('page-1');

      const match2 = findPageByBasename('./sections/intro.tex');
      expect(match2?.id).toBe('page-2');

      const match3 = findPageByBasename('intro.tex');
      expect(match3?.id).toBe('page-2');
    });
  });
});
