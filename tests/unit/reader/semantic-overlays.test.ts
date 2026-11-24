import { describe, it, expect } from 'vitest';
import {
  buildSemanticLookupIndex,
  buildSemanticPageOverlays,
  hitTestSemanticOverlays,
  refineSemanticOverlaysWithTextLayer,
} from '@/features/library/domain/reader/semantic-overlays';
import { rotatePointFromCanonical, type PdfPageHoverGeometry } from '@/features/library/domain/reader/annotation-geometry';
import type { DocumentFulltext } from '@/features/library/types/reader.types';

function createAdamAndBracketFulltext(): DocumentFulltext {
  return {
    sections: [
      { id: 'sec-1', num: '1', title: 'Introduction', paragraphs: ['Intro paragraph'], page: 1 },
      { id: 'sec-refs', num: '', title: 'References', paragraphs: [], page: 9 },
    ],
    figures: [{ id: 'fig-1', label: 'Figure 1', caption: 'Training loss curves.', page: 4 }],
    tables: [],
    formulas: [],
    references: [
      {
        authors: ['Li Deng', 'Jinyu Li', 'Jui-Ting Huang'],
        year: 2013,
        title: 'Recent advances in deep learning for speech research at Microsoft',
        rawCitation: 'Deng, L., Li, J., & Huang, J.-T. (2013). Recent advances in deep learning for speech research at Microsoft. ICASSP.',
      },
      {
        authors: ['Alex Krizhevsky', 'Ilya Sutskever', 'Geoffrey E. Hinton'],
        year: 2012,
        title: 'ImageNet classification with deep convolutional neural networks',
        rawCitation: 'Krizhevsky, A., Sutskever, I., & Hinton, G. E. (2012). ImageNet classification with deep convolutional neural networks. NIPS.',
      },
      {
        authors: ['Geoffrey E. Hinton', 'Ruslan R. Salakhutdinov'],
        year: 2006,
        title: 'Reducing the dimensionality of data with neural networks',
        rawCitation: 'Hinton, G. E., & Salakhutdinov, R. R. (2006). Reducing the dimensionality of data with neural networks. Science.',
      },
      {
        authors: ['Geoffrey E. Hinton', 'Li Deng', 'Dong Yu'],
        year: 2012,
        title: 'Deep neural networks for acoustic modeling in speech recognition',
        rawCitation: 'Hinton, G., Deng, L., Yu, D., et al. (2012a). Deep neural networks for acoustic modeling in speech recognition. IEEE SPM.',
      },
      {
        authors: ['Geoffrey E. Hinton', 'Nitish Srivastava', 'Alex Krizhevsky'],
        year: 2012,
        title: 'Improving neural networks by preventing co-adaptation of feature detectors',
        rawCitation: 'Hinton, G. E., Srivastava, N., Krizhevsky, A., et al. (2012b). Improving neural networks by preventing co-adaptation of feature detectors.',
      },
      {
        authors: ['Karen Simonyan', 'Andrew Zisserman'],
        year: 2015,
        title: 'Very deep convolutional networks for large-scale image recognition',
        rawCitation: '[6] K. Simonyan and A. Zisserman. Very deep convolutional networks for large-scale image recognition. In ICLR, 2015.',
      },
      {
        authors: ['Kaiming He', 'Xiangyu Zhang', 'Shaoqing Ren', 'Jian Sun'],
        year: 2016,
        title: 'Deep residual learning for image recognition',
        rawCitation: '[7] K. He, X. Zhang, S. Ren, and J. Sun. Deep residual learning for image recognition. In CVPR, 2016.',
      },
    ],
  };
}

describe('semantic-overlays domain', () => {
  it('extracts native PDF /Link overlays with exact /Link rects for bracket citations ([6], [6, 7])', () => {
    const lookup = buildSemanticLookupIndex(createAdamAndBracketFulltext(), 10);
    const geometry: PdfPageHoverGeometry = {
      links: [
        { x1: 0.25, y1: 0.30, x2: 0.29, y2: 0.32, dest: 'cite.simonyan' },
        { x1: 0.42, y1: 0.30, x2: 0.49, y2: 0.32, dest: 'cite.multi' },
      ],
      textItems: [
        { str: 'Compared to ', x1: 0.10, y1: 0.30, x2: 0.25, y2: 0.32 },
        { str: '[6]', x1: 0.25, y1: 0.30, x2: 0.29, y2: 0.32 },
        { str: ' and earlier work ', x1: 0.29, y1: 0.30, x2: 0.42, y2: 0.32 },
        { str: '[6, 7]', x1: 0.42, y1: 0.30, x2: 0.49, y2: 0.32 },
        { str: '.', x1: 0.49, y1: 0.30, x2: 0.50, y2: 0.32 },
      ],
    };

    const overlays = buildSemanticPageOverlays(2, geometry, lookup);
    expect(overlays).toHaveLength(2);

    expect(overlays[0]).toMatchObject({
      source: 'pdf-link',
      type: 'citation',
      kind: 'Reference',
      pageNumber: 2,
      rects: [{ x1: 0.25, y1: 0.30, x2: 0.29, y2: 0.32 }],
    });
    expect(overlays[0]!.entries).toHaveLength(1);
    expect(overlays[0]!.entries[0]!.badge).toBe('[6]');
    expect(overlays[0]!.entries[0]!.rawCitation).toContain('Simonyan and A. Zisserman');

    expect(overlays[1]).toMatchObject({
      source: 'pdf-link',
      type: 'citation',
      kind: 'Reference',
      rects: [{ x1: 0.42, y1: 0.30, x2: 0.49, y2: 0.32 }],
    });
    expect(overlays[1]!.entries.map((e) => e.badge)).toEqual(['[6]', '[7]']);
  });

  it('extracts unlinked APA/ICLR author-year citations including multi-line wrapped citations', () => {
    const lookup = buildSemanticLookupIndex(createAdamAndBracketFulltext(), 10);
    const geometry: PdfPageHoverGeometry = {
      links: [],
      textItems: [
        {
          str: 'recent advances (Deng et al., 2013; Hinton',
          x1: 0.12,
          y1: 0.40,
          x2: 0.85,
          y2: 0.42,
        },
        {
          str: '& Salakhutdinov, 2006; Hinton et al., 2012a).',
          x1: 0.12,
          y1: 0.425,
          x2: 0.80,
          y2: 0.445,
        },
        {
          str: 'Also see dropout (Hinton et al., 2012b) and Figure 1.',
          x1: 0.12,
          y1: 0.455,
          x2: 0.82,
          y2: 0.475,
        },
      ],
    };

    const overlays = buildSemanticPageOverlays(1, geometry, lookup);

    const figOverlay = overlays.find((o) => o.kind === 'Figure');
    expect(figOverlay).toBeDefined();
    expect(figOverlay!.entries[0]!.targetPage).toBe(4);

    const refOverlays = overlays.filter((o) => o.kind === 'Reference');
    expect(refOverlays.map((o) => o.entries[0]!.badge)).toEqual([
      'Deng et al., 2013',
      'Hinton & Salakhutdinov, 2006',
      'Hinton et al., 2012a',
      'Hinton et al., 2012b',
    ]);

    // Wrapped citation produces 2 distinct per-line rects without cross-page jumping
    const hintonSalakhutdinov = refOverlays[1]!;
    expect(hintonSalakhutdinov.source).toBe('matched');
    expect(hintonSalakhutdinov.rects).toHaveLength(2);
    expect(hintonSalakhutdinov.rects[0]!.y1).toBeCloseTo(0.40, 3);
    expect(hintonSalakhutdinov.rects[1]!.y1).toBeCloseTo(0.425, 3);

    // 2012a vs 2012b disambiguation picks distinct references
    expect(refOverlays[2]!.entries[0]!.rawCitation).toContain('2012a');
    expect(refOverlays[3]!.entries[0]!.rawCitation).toContain('2012b');
  });

  it('deduplicates matched overlays when an overlapping /Link overlay already exists', () => {
    const lookup = buildSemanticLookupIndex(createAdamAndBracketFulltext(), 10);
    const geometry: PdfPageHoverGeometry = {
      links: [
        // Exact link covering (Deng et al., 2013)
        { x1: 0.25, y1: 0.20, x2: 0.55, y2: 0.22, dest: 'cite.deng' },
        // External HTTPS link must NOT shadow or consume citation detection
        { x1: 0.60, y1: 0.20, x2: 0.85, y2: 0.22, url: 'https://arxiv.org/abs/1412.6980' },
      ],
      textItems: [
        { str: 'See ', x1: 0.20, y1: 0.20, x2: 0.25, y2: 0.22 },
        { str: 'Deng et al., 2013', x1: 0.25, y1: 0.20, x2: 0.55, y2: 0.22 },
        { str: ' ([6])', x1: 0.55, y1: 0.20, x2: 0.60, y2: 0.22 },
      ],
    };

    const overlays = buildSemanticPageOverlays(3, geometry, lookup);
    const dengOverlays = overlays.filter((o) =>
      o.entries.some((e) => e.badge.includes('Deng')),
    );
    expect(dengOverlays).toHaveLength(1);
    expect(dengOverlays[0]!.source).toBe('pdf-link');

    const bracketOverlay = overlays.find((o) => o.entries.some((e) => e.badge === '[6]'));
    expect(bracketOverlay).toBeDefined();
    expect(bracketOverlay!.source).toBe('matched');
  });

  it('hit-tests canonical overlays accurately at 0 deg and 90 deg page rotations', () => {
    const lookup = buildSemanticLookupIndex(createAdamAndBracketFulltext(), 10);
    const geometry: PdfPageHoverGeometry = {
      links: [{ x1: 0.20, y1: 0.30, x2: 0.28, y2: 0.33, dest: 'cite.6' }],
      textItems: [{ str: '[6]', x1: 0.20, y1: 0.30, x2: 0.28, y2: 0.33 }],
    };

    const overlays = buildSemanticPageOverlays(1, geometry, lookup);
    expect(overlays).toHaveLength(1);

    // 0 deg: inside [0.20..0.28, 0.30..0.33]
    expect(hitTestSemanticOverlays(overlays, 0.24, 0.315, 0)?.id).toBe(overlays[0]!.id);
    expect(hitTestSemanticOverlays(overlays, 0.50, 0.315, 0)).toBeNull();

    // 90 deg clockwise: project canonical point (0.24, 0.315) to rotated viewport space
    const rotatedPt = rotatePointFromCanonical({ x: 0.24, y: 0.315 }, 90);
    expect(hitTestSemanticOverlays(overlays, rotatedPt.x, rotatedPt.y, 90)?.id).toBe(
      overlays[0]!.id,
    );
    // Original unrotated coords must miss when page is rotated 90 deg
    expect(hitTestSemanticOverlays(overlays, 0.24, 0.315, 90)).toBeNull();
  });

  it('extracts unnumbered APA/ICLR references under LaTeX small-caps R EFERENCES when fulltext.references is empty or mashed and skips Section text popups', () => {
    const refPageText = [
      'R EFERENCES',
      'Duchi, John, Hazan, Elad, and Singer, Yoram. Adaptive subgradient methods for online learning and',
      'stochastic optimization. The Journal of Machine Learning Research, 12:2121-2159, 2011.',
      'Graves, Alex. Generating sequences with recurrent neural networks. arXiv preprint arXiv:1308.0850,',
      '2013.',
      'Pascanu, Razvan and Bengio, Yoshua. Revisiting natural gradient for deep networks. arXiv preprint',
      'arXiv:1301.3584, 2013.',
      'Tieleman, T. and Hinton, G. Lecture 6.5 - RMSProp, COURSERA: Neural Networks for Machine',
      'Learning. Technical report, 2012.',
    ].join('\n');

    const fulltextEmptyRefs: DocumentFulltext = {
      sections: [
        { id: 'sec-6-4', num: '6.4', title: 'Bias-correction term', paragraphs: ['Empirical analysis'], page: 6 },
      ],
      figures: [],
      tables: [],
      formulas: [],
      references: [],
      pages: [
        { pageNumber: 1, text: '1 Introduction' },
        { pageNumber: 9, text: refPageText },
      ],
    };

    const lookupFromEmpty = buildSemanticLookupIndex(fulltextEmptyRefs, 10);
    expect(lookupFromEmpty.indexedReferences).toHaveLength(4);

    // Also test recovering from a single mashed entry (> 600 chars)
    const fulltextMashedRefs: DocumentFulltext = {
      ...fulltextEmptyRefs,
      references: [
        {
          authors: [],
          year: 2011,
          rawCitation: refPageText.repeat(2),
        },
      ],
    };
    const lookupFromMashed = buildSemanticLookupIndex(fulltextMashedRefs, 10);
    expect(lookupFromMashed.indexedReferences).toHaveLength(4);

    const geometry: PdfPageHoverGeometry = {
      links: [],
      textItems: [
        { str: 'matrix (Pascanu & Bengio, 2013); however,', x1: 0.12, y1: 0.20, x2: 0.80, y2: 0.22 },
        { str: 'closely related to Adam is RMSProp (Tieleman & Hinton,', x1: 0.12, y1: 0.28, x2: 0.85, y2: 0.30 },
        { str: '2012), while SGD (Graves, 2013). We demonstrate in section 6.4.', x1: 0.12, y1: 0.305, x2: 0.82, y2: 0.325 },
        { str: 'Works well for sparse gradients is AdaGrad (Duchi et al., 2011).', x1: 0.12, y1: 0.40, x2: 0.82, y2: 0.42 },
      ],
    };

    const overlays = buildSemanticPageOverlays(6, geometry, lookupFromEmpty);
    const refBadges = overlays
      .filter((o) => o.kind === 'Reference')
      .map((o) => o.entries[0]!.badge);
    expect(refBadges).toEqual([
      'Pascanu & Bengio, 2013',
      'Tieleman & Hinton, 2012',
      'Graves, 2013',
      'Duchi et al., 2011',
    ]);
    expect(overlays.some((o) => o.kind === 'Section')).toBe(false);
  });

  it('refines matched overlays split across multiple TextLayer spans on the same visual line', () => {
    const pageEl = document.createElement('div');
    const textLayer = document.createElement('div');
    textLayer.className = 'textLayer';
    pageEl.appendChild(textLayer);

    // Case 1: "since [" + "11]" across 2 spans
    const spanA = document.createElement('span');
    spanA.textContent = 'since [';
    const spanB = document.createElement('span');
    spanB.textContent = '11] in order';

    // Case 2: "GPU hardware [" + "16," + "9]." (no space before 9 in span vs "[16, 9]")
    const spanC = document.createElement('span');
    spanC.textContent = 'GPU hardware [';
    const spanD = document.createElement('span');
    spanD.textContent = '16,';
    const spanE = document.createElement('span');
    spanE.textContent = '9]. Also';

    textLayer.append(spanA, spanB, spanC, spanD, spanE);

    const makeRect = (left: number, top: number, right: number, bottom: number): DOMRect =>
      ({
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;

    const spanLayouts = new Map<HTMLElement, { left: number; top: number; right: number; bottom: number }>([
      [spanA, { left: 100, top: 200, right: 170, bottom: 220 }], // 7 chars -> 10px/char; "[" at 160..170
      [spanB, { left: 170, top: 200, right: 290, bottom: 220 }], // 12 chars -> 10px/char; "11]" at 170..200
      [spanC, { left: 500, top: 400, right: 640, bottom: 420 }], // 14 chars -> 10px/char; "[" at 630..640
      [spanD, { left: 640, top: 400, right: 670, bottom: 420 }], // 3 chars -> 10px/char; "16," at 640..670
      [spanE, { left: 675, top: 400, right: 755, bottom: 420 }], // 8 chars -> 10px/char; "9]" at 675..695
    ]);

    pageEl.getBoundingClientRect = () => makeRect(0, 0, 1000, 1000);
    for (const [el, box] of spanLayouts.entries()) {
      el.getBoundingClientRect = () => makeRect(box.left, box.top, box.right, box.bottom);
    }

    const origDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');
    Range.prototype.getBoundingClientRect = function (this: Range) {
      const spanEl = this.startContainer.parentElement;
      const box = spanEl ? spanLayouts.get(spanEl) : undefined;
      if (!box) return makeRect(0, 0, 0, 0);
      const totalLen = Math.max(1, (this.startContainer.textContent || '').length);
      const width = box.right - box.left;
      const left = box.left + (width * this.startOffset) / totalLen;
      const right = box.left + (width * this.endOffset) / totalLen;
      return makeRect(left, box.top, right, box.bottom);
    };

    try {
      const overlays = [
        {
          id: 'ov-11',
          source: 'matched' as const,
          type: 'citation' as const,
          kind: 'Reference' as const,
          pageNumber: 1,
          matchedText: '[11]',
          // Slightly shifted approximate rect (typical of proportional measurement drift on justified lines)
          rects: [{ x1: 0.175, y1: 0.20, x2: 0.215, y2: 0.22, width: 0.04, height: 0.02 }],
          entries: [],
        },
        {
          id: 'ov-16-9',
          source: 'matched' as const,
          type: 'citation' as const,
          kind: 'Reference' as const,
          pageNumber: 1,
          matchedText: '[16, 9]',
          rects: [{ x1: 0.645, y1: 0.40, x2: 0.71, y2: 0.42, width: 0.065, height: 0.02 }],
          entries: [],
        },
      ];

      const refined = refineSemanticOverlaysWithTextLayer(pageEl, overlays, 0);
      expect(refined).toHaveLength(2);
      // Union of "[" (160..170) and "11]" (170..200) -> 0.16..0.20
      expect(refined[0]!.rects[0]!.x1).toBeCloseTo(0.16, 4);
      expect(refined[0]!.rects[0]!.x2).toBeCloseTo(0.20, 4);
      // Union of "[" (630..640), "16," (640..670), "9]" (675..695) -> 0.63..0.695
      expect(refined[1]!.rects[0]!.x1).toBeCloseTo(0.63, 4);
      expect(refined[1]!.rects[0]!.x2).toBeCloseTo(0.695, 4);
    } finally {
      if (origDescriptor) {
        Object.defineProperty(Range.prototype, 'getBoundingClientRect', origDescriptor);
      } else {
        delete (Range.prototype as unknown as { getBoundingClientRect?: unknown }).getBoundingClientRect;
      }
    }
  });

  it('skips bibliography entries inside References pages and below mid-page References headings while preserving Appendix citations', () => {
    const baseFulltext = createAdamAndBracketFulltext();
    const fulltextWithRefsAndAppendix: DocumentFulltext = {
      ...baseFulltext,
      sections: [
        { id: 'sec-1', num: '1', title: 'Introduction', paragraphs: [], page: 1 },
        { id: 'sec-refs', num: '', title: 'References', paragraphs: [], page: 8 },
        { id: 'sec-app', num: 'A', title: 'Appendix', paragraphs: [], page: 10 },
      ],
    };

    const lookup = buildSemanticLookupIndex(fulltextWithRefsAndAppendix, 11);
    expect(lookup.bibliographyStartPage).toBe(8);
    expect(lookup.bibliographyEndPage).toBe(10);

    // 1. Full References page (page 9, strictly between start 8 and end 10): 0 reference overlays
    const refsPageGeometry: PdfPageHoverGeometry = {
      links: [{ x1: 0.12, y1: 0.15, x2: 0.15, y2: 0.17, dest: 'cite.3' }],
      textItems: [
        { str: '[3] U. V. Catalyurek, C. Aykanat, and B. Ucar.', x1: 0.12, y1: 0.15, x2: 0.45, y2: 0.17 },
        { str: '[6] K. Simonyan and A. Zisserman (2015).', x1: 0.12, y1: 0.35, x2: 0.45, y2: 0.37 },
        { str: '[7] K. He, X. Zhang, S. Ren, and J. Sun.', x1: 0.52, y1: 0.15, x2: 0.88, y2: 0.17 },
      ],
    };
    const refsPageOverlays = buildSemanticPageOverlays(9, refsPageGeometry, lookup);
    expect(refsPageOverlays.filter((o) => o.kind === 'Reference')).toHaveLength(0);

    // 2. Mixed page (page 8, References starts mid-page in left column): above heading kept, below heading & right column skipped
    const mixedPageGeometry: PdfPageHoverGeometry = {
      links: [],
      textItems: [
        { str: 'We compare against baseline [6] in experiments.', x1: 0.12, y1: 0.20, x2: 0.46, y2: 0.22 },
        { str: 'References', x1: 0.12, y1: 0.40, x2: 0.24, y2: 0.42 },
        { str: '[1] L. Deng, J. Li, and J.-T. Huang.', x1: 0.12, y1: 0.45, x2: 0.46, y2: 0.47 },
        { str: '[2] A. Krizhevsky, I. Sutskever, and G. Hinton.', x1: 0.52, y1: 0.20, x2: 0.88, y2: 0.22 },
      ],
    };
    const mixedOverlays = buildSemanticPageOverlays(8, mixedPageGeometry, lookup);
    const mixedRefBadges = mixedOverlays
      .filter((o) => o.kind === 'Reference')
      .map((o) => o.entries[0]!.badge);
    expect(mixedRefBadges).toEqual(['[6]']);

    // 3. Appendix page after References (page 10 >= bibliographyEndPage): citations are still matched
    const appendixGeometry: PdfPageHoverGeometry = {
      links: [],
      textItems: [
        { str: 'Additional ablation using [7] confirms robustness.', x1: 0.12, y1: 0.25, x2: 0.70, y2: 0.27 },
      ],
    };
    const appendixOverlays = buildSemanticPageOverlays(10, appendixGeometry, lookup);
    const appendixBadges = appendixOverlays
      .filter((o) => o.kind === 'Reference')
      .map((o) => o.entries[0]!.badge);
    expect(appendixBadges).toEqual(['[7]']);
  });
});
