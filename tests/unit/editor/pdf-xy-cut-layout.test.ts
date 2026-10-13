import { describe, it, expect } from 'vitest';
import {
  extractTextItemsFromTextContent,
  coalesceHorizontalFragments,
  computeBoundingBox,
  performRecursiveXyCut,
  type PdfTextItem,
} from '@/features/editor/domain/pdf/xy-cut';

describe('PDF Recursive XY-Cut Multi-Column Layout Analysis & Reading Order', () => {
  describe('1. PDF.js Text Content Coordinate Normalization', () => {
    it('normalizes PDF bottom-left coordinates into screen top-left coordinates', () => {
      const mockTextContent = {
        items: [
          {
            str: 'Header Title',
            transform: [12, 0, 0, 12, 54, 792], // PDF bottom-left origin: ty = 792 pt, height = 12 pt
            width: 120,
            height: 12,
          },
        ],
      };

      const pageView = [0, 0, 595, 842]; // A4 page height 842 pt
      const items = extractTextItemsFromTextContent(mockTextContent, pageView);

      expect(items.length).toBe(1);
      expect(items[0].str).toBe('Header Title');
      expect(items[0].x).toBe(54);
      // y = 842 - 792 - 12 = 38 pt
      expect(items[0].y).toBe(38);
      expect(items[0].w).toBe(120);
      expect(items[0].h).toBe(12);
    });

    it('assigns progressive synthetic y-coordinates when items lack transform matrices', () => {
      const mockTextContent = {
        items: [
          { str: 'First Line' },
          { str: 'Second Line' },
          { str: 'Third Line' },
        ],
      };

      const items = extractTextItemsFromTextContent(mockTextContent);
      expect(items.length).toBe(3);
      expect(items[0].y).toBe(0);
      expect(items[1].y).toBe(16);
      expect(items[2].y).toBe(32);
    });

    it('returns empty array when textContent is empty or invalid', () => {
      expect(extractTextItemsFromTextContent({ items: [] })).toEqual([]);
      expect(extractTextItemsFromTextContent(null as any)).toEqual([]);
    });
  });

  describe('2. Horizontal Word and Fragment Coalescence', () => {
    it('coalesces adjacent word fragments on the same baseline into a cohesive line', () => {
      const fragments: PdfTextItem[] = [
        { str: 'Deep', x: 50, y: 100, w: 30, h: 12 },
        { str: 'learning', x: 84, y: 100, w: 50, h: 12 }, // adjacent
        { str: 'models', x: 138, y: 100, w: 45, h: 12 },   // adjacent
      ];

      const coalesced = coalesceHorizontalFragments(fragments);
      expect(coalesced.length).toBe(1);
      expect(coalesced[0].str).toBe('Deep learning models');
      expect(coalesced[0].x).toBe(50);
      expect(coalesced[0].w).toBe(138 + 45 - 50);
    });

    it('preserves distinct horizontal lines on different vertical baselines', () => {
      const fragments: PdfTextItem[] = [
        { str: 'Line 1', x: 50, y: 100, w: 50, h: 12 },
        { str: 'Line 2', x: 50, y: 120, w: 50, h: 12 },
      ];

      const coalesced = coalesceHorizontalFragments(fragments);
      expect(coalesced.length).toBe(2);
      expect(coalesced[0].str).toBe('Line 1');
      expect(coalesced[1].str).toBe('Line 2');
    });
  });

  describe('3. Single-Column Layout & Paragraph Segmentation', () => {
    it('processes single-column text in natural top-to-bottom order with correct block separation', () => {
      const items: PdfTextItem[] = [
        { str: 'Document Title', x: 50, y: 50, w: 200, h: 16 },
        // Paragraph 1
        { str: 'This is the first sentence of paragraph one.', x: 50, y: 80, w: 300, h: 10 },
        { str: 'This is the second sentence of paragraph one.', x: 50, y: 92, w: 300, h: 10 },
        // Paragraph 2 (gap > 6 pt)
        { str: 'This starts paragraph two after a clear vertical gap.', x: 50, y: 120, w: 300, h: 10 },
      ];

      const layout = performRecursiveXyCut(items);

      expect(layout.columnCount).toBe(1);
      expect(layout.blocks.length).toBe(3); // Title, Para 1, Para 2
      expect(layout.blocks[0].text).toBe('Document Title');
      expect(layout.blocks[1].text).toContain('first sentence');
      expect(layout.blocks[1].text).toContain('second sentence');
      expect(layout.blocks[2].text).toContain('starts paragraph two');
      expect(layout.fullText).toContain('Document Title\n\nThis is the first sentence');
    });
  });

  describe('4. Two-Column Scientific Document (IEEE / ACM / arXiv)', () => {
    it('restores natural reading order when raw PDF stream interleaves lines between columns', () => {
      // Simulate typical scientific paper layout:
      // - Spanning Title at Top (x = 100, y = 50, w = 400)
      // - Spanning Abstract (x = 80, y = 80, w = 440)
      // - Column 1 (Left): x in [50, 250], y from 130 to 170
      // - Column 2 (Right): x in [330, 530], y from 130 to 170
      //
      // Raw stream is interleaved: Col1-L1, Col2-L1, Col1-L2, Col2-L2, Col1-L3, Col2-L3
      const rawInterleavedItems: PdfTextItem[] = [
        // Spanning Header
        { str: 'Deep Residual Learning for Image Recognition', x: 100, y: 40, w: 400, h: 18 },
        { str: 'Abstract - Deeper neural networks are more difficult to train.', x: 80, y: 75, w: 440, h: 11 },

        // Interleaved Column 1 & Column 2 lines
        { str: '1. Introduction', x: 54, y: 120, w: 190, h: 11 },
        { str: '2. Related Work', x: 334, y: 120, w: 190, h: 11 },

        { str: 'Deep convolutional networks have led to', x: 54, y: 135, w: 190, h: 10 },
        { str: 'Residual Representations. In computer vision,', x: 334, y: 135, w: 190, h: 10 },

        { str: 'a series of breakthroughs for image classification.', x: 54, y: 150, w: 190, h: 10 },
        { str: 'VLAD is a representation that encodes residuals.', x: 334, y: 150, w: 190, h: 10 },
      ];

      const layout = performRecursiveXyCut(rawInterleavedItems, {
        pageWidth: 595,
        pageHeight: 842,
        minColumnGutter: 20, // Gutter between x=244 and x=334 is 90 pt
      });

      expect(layout.columnCount).toBe(2);

      // Verify that the ordered stream places ALL of Column 1 before Column 2!
      const orderedStrings = layout.orderedItems.map((it) => it.str);

      // Index of items
      const idxTitle = orderedStrings.findIndex((s) => s.includes('Deep Residual Learning'));
      const idxAbstract = orderedStrings.findIndex((s) => s.includes('Abstract'));
      const idxIntro = orderedStrings.findIndex((s) => s.includes('1. Introduction'));
      const idxCol1Breakthroughs = orderedStrings.findIndex((s) => s.includes('breakthroughs'));
      const idxRelated = orderedStrings.findIndex((s) => s.includes('2. Related Work'));
      const idxCol2Vlad = orderedStrings.findIndex((s) => s.includes('VLAD'));

      // Strict sequential order
      expect(idxTitle).toBeLessThan(idxAbstract);
      expect(idxAbstract).toBeLessThan(idxIntro);
      expect(idxIntro).toBeLessThan(idxCol1Breakthroughs);
      expect(idxCol1Breakthroughs).toBeLessThan(idxRelated); // Column 1 ends before Column 2 starts!
      expect(idxRelated).toBeLessThan(idxCol2Vlad);

      // Full text verification
      expect(layout.fullText).toContain('1. Introduction\nDeep convolutional networks have led to\na series of breakthroughs for image classification.');
      expect(layout.fullText).toContain('2. Related Work\nResidual Representations. In computer vision,\nVLAD is a representation that encodes residuals.');
    });
  });

  describe('5. Robustness & Edge Cases', () => {
    it('handles empty text item list gracefully', () => {
      const layout = performRecursiveXyCut([]);
      expect(layout.columnCount).toBe(1);
      expect(layout.blocks).toEqual([]);
      expect(layout.fullText).toBe('');
      expect(layout.orderedItems).toEqual([]);
    });

    it('handles single item without throwing or recursing indefinitely', () => {
      const single: PdfTextItem[] = [{ str: 'Solo', x: 50, y: 50, w: 30, h: 10 }];
      const layout = performRecursiveXyCut(single);
      expect(layout.blocks.length).toBe(1);
      expect(layout.fullText).toBe('Solo');
      expect(layout.orderedItems.length).toBe(1);
    });

    it('computes accurate composite bounding box for all items', () => {
      const items: PdfTextItem[] = [
        { str: 'A', x: 10, y: 20, w: 50, h: 10 },
        { str: 'B', x: 100, y: 80, w: 80, h: 15 },
      ];
      const bbox = computeBoundingBox(items);
      expect(bbox.x).toBe(10);
      expect(bbox.y).toBe(20);
      expect(bbox.w).toBe(170); // 180 - 10
      expect(bbox.h).toBe(75);  // 95 - 20
    });
  });
});
