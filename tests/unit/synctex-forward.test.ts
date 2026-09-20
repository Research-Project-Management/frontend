import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseSyncTeX,
  LatexCompilerEngine,
  type SyncTeXMap,
} from '@/features/editor/utils/viewer.util';
import { synctexService } from '@/features/editor/services/synctex.service';

describe('Forward SyncTeX (Code Cursor -> PDF Highlight & Bounding Box)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseSyncTeX Bounding Box Extraction', () => {
    const mockSyncTeXWithBoxes = `SyncTeX Version:1
Input:1:./main.tex
Input:2:./sections/methodology.tex
{1
[1,10,0:6553600,13107200:29491200,917504
(1,25,0:6553600,26214400:19660800,655360
x1,30:6553600,32768000
}
{2
[2,50,0:6553600,6553600:32768000,1310720
}`;

    it('should parse box width (w) and height (h) when present in records', () => {
      const map: SyncTeXMap = parseSyncTeX(mockSyncTeXWithBoxes);

      const page1Nodes = map.pageToNodes.get(1);
      expect(page1Nodes).toBeDefined();
      expect(page1Nodes?.length).toBe(3);

      // Node 1: vbox with w: 29491200 sp (450 pt), h: 917504 sp (14 pt)
      expect(page1Nodes![0]).toMatchObject({
        line: 10,
        tag: 1,
        x: 6553600,
        y: 13107200,
        w: 29491200,
        h: 917504,
        page: 1,
      });

      // Node 2: hbox with w: 19660800 sp (300 pt), h: 655360 sp (10 pt)
      expect(page1Nodes![1]).toMatchObject({
        line: 25,
        tag: 1,
        x: 6553600,
        y: 26214400,
        w: 19660800,
        h: 655360,
        page: 1,
      });

      // Node 3: point record without w and h
      expect(page1Nodes![2]).toMatchObject({
        line: 30,
        tag: 1,
        x: 6553600,
        y: 32768000,
        page: 1,
      });
      expect(page1Nodes![2].w).toBeUndefined();
      expect(page1Nodes![2].h).toBeUndefined();
    });

    it('should parse sub-file nodes and boxes for multi-page documents', () => {
      const map: SyncTeXMap = parseSyncTeX(mockSyncTeXWithBoxes);

      const page2Nodes = map.pageToNodes.get(2);
      expect(page2Nodes).toBeDefined();
      expect(page2Nodes?.length).toBe(1);

      expect(page2Nodes![0]).toMatchObject({
        line: 50,
        tag: 2,
        x: 6553600,
        y: 6553600,
        w: 32768000,
        h: 1310720,
        page: 2,
      });
    });
  });

  describe('LatexCompilerEngine.resolveForwardDetail', () => {
    const mockSyncTeXContent = `SyncTeX Version:1
Input:1:./main.tex
Input:2:./sections/methodology.tex
{1
[1,15,0:6553600,13107200:26214400,917504
x1,42:6553600,26214400
}
{2
[2,80,0:6553600,19660800:19660800,655360
}`;

    it('should resolve page, coordinates and bounding box dimensions for main file', () => {
      const map = parseSyncTeX(mockSyncTeXContent);

      const res = LatexCompilerEngine.resolveForwardDetail(15, map, 'main.tex', 2);
      expect(res).not.toBeNull();
      expect(res?.page).toBe(1);
      expect(res?.x).toBe(6553600);
      expect(res?.y).toBe(13107200);
      expect(res?.w).toBe(26214400);
      expect(res?.h).toBe(917504);
    });

    it('should resolve correctly for sub-files via activeTitle matching', () => {
      const map = parseSyncTeX(mockSyncTeXContent);

      const res = LatexCompilerEngine.resolveForwardDetail(80, map, 'sections/methodology.tex', 2);
      expect(res).not.toBeNull();
      expect(res?.page).toBe(2);
      expect(res?.x).toBe(6553600);
      expect(res?.y).toBe(19660800);
      expect(res?.w).toBe(19660800);
      expect(res?.h).toBe(655360);
    });

    it('should resolve point nodes without width/height gracefully', () => {
      const map = parseSyncTeX(mockSyncTeXContent);

      const res = LatexCompilerEngine.resolveForwardDetail(42, map, 'main.tex', 2);
      expect(res).not.toBeNull();
      expect(res?.page).toBe(1);
      expect(res?.x).toBe(6553600);
      expect(res?.y).toBe(26214400);
      expect(res?.w).toBeUndefined();
      expect(res?.h).toBeUndefined();
    });

    it('should return null when synctexMap is null or line not found', () => {
      expect(LatexCompilerEngine.resolveForwardDetail(10, null, 'main.tex')).toBeNull();

      const map = parseSyncTeX(mockSyncTeXContent);
      expect(LatexCompilerEngine.resolveForwardDetail(9999, map, 'main.tex')).toBeNull();
    });
  });

  describe('LatexCompilerEngine.resolveForward (Page number lookup)', () => {
    const mockSyncTeXContent = `SyncTeX Version:1
Input:1:./main.tex
{1
x1,10:0,0
}
{2
x1,55:0,0
}`;

    it('should return the corresponding page number', () => {
      const map = parseSyncTeX(mockSyncTeXContent);
      expect(LatexCompilerEngine.resolveForward(10, map, 'main.tex')).toBe(1);
      expect(LatexCompilerEngine.resolveForward(55, map, 'main.tex')).toBe(2);
    });
  });

  describe('LatexCompilerEngine.resolveForwardRemote (Backend Single Source of Truth)', () => {
    it('should query synctexService.forwardSync and return full coordinate and box result', async () => {
      const mockResult = {
        page: 3,
        x: 120,
        y: 280,
        w: 420,
        h: 15,
      };

      vi.spyOn(synctexService, 'forwardSync').mockResolvedValueOnce(mockResult);

      const res = await LatexCompilerEngine.resolveForwardRemote(
        'proj-456',
        'main.tex',
        45,
      );

      expect(synctexService.forwardSync).toHaveBeenCalledWith({
        projectId: 'proj-456',
        file: 'main.tex',
        line: 45,
        column: 0,
      });

      expect(res).toEqual(mockResult);
    });

    it('should handle remote failure gracefully', async () => {
      vi.spyOn(synctexService, 'forwardSync').mockRejectedValueOnce(new Error('Compiler unreachable'));

      const res = await LatexCompilerEngine.resolveForwardRemote(
        'proj-456',
        'main.tex',
        45,
      );

      expect(res).toBeNull();
    });
  });
});
