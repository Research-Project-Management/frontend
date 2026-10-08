import { describe, it, expect, beforeEach } from 'vitest';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { citationHoverSource } from '@/features/editor/engines/extensions/latex-citation-hover';
import { runLatexLinter } from '@/features/editor/engines/extensions/latex-linter-core';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

describe('Editor Citation Retraction Warning Subsystem (Overleaf Parity)', () => {
  beforeEach(() => {
    latexSymbolsIndex.clear();
  });

  it('correctly ingests retraction status from workspace library items', () => {
    latexSymbolsIndex.setLibraryCitations([
      {
        id: 'item-retracted-1',
        citationKey: 'fakePaper2020',
        title: 'Fabricated Superconductivity Results',
        authors: ['Smith, John', 'Doe, Jane'],
        year: 2020,
        doi: '10.1016/j.fake.2020.001',
        isRetracted: true,
        retractionReason: 'Data fabrication in figure 4 detected during external audit',
        noticeUrl: 'https://publisher.org/notices/retraction-2020.pdf',
      },
    ]);

    const entry = latexSymbolsIndex.getCitationByKey('fakePaper2020');
    expect(entry).toBeDefined();
    expect(entry?.isRetracted).toBe(true);
    expect(entry?.retractionReason).toContain('Data fabrication');
    expect(entry?.retractionNoticeUrl).toBe('https://publisher.org/notices/retraction-2020.pdf');
  });

  it('dynamically cross-matches project .bib entries by DOI against retracted library items', () => {
    // 1. Library has a retracted paper with a specific DOI
    latexSymbolsIndex.setLibraryCitations([
      {
        id: 'lib-doi-retracted',
        citationKey: 'libKey2019',
        doi: 'https://doi.org/10.1038/s41586-019-retracted',
        isRetracted: true,
        retractionReason: 'Unreproducible experimental results',
        noticeUrl: 'https://nature.com/articles/retraction-notice',
      },
    ]);

    // 2. Project .bib file was authored independently with a different citekey but matching DOI
    latexSymbolsIndex.indexFile(
      'ref.bib',
      'references.bib',
      `@article{myLocalCitekey,
  author = {Dupont, Pierre},
  title = {Cold Fusion Breakthrough},
  year = {2019},
  doi = {10.1038/s41586-019-retracted}
}`,
      true
    );

    const localEntry = latexSymbolsIndex.getCitationByKey('myLocalCitekey');
    expect(localEntry).toBeDefined();
    // Must be dynamically flagged as retracted by DOI match!
    expect(localEntry?.isRetracted).toBe(true);
    expect(localEntry?.retractionReason).toContain('Unreproducible experimental results');
  });

  it('renders prominent red warning badge and retraction notice callout in hover card', () => {
    latexSymbolsIndex.setLibraryCitations([
      {
        id: 'retracted-2',
        citationKey: 'discredited2021',
        title: 'Discredited Medical Protocol',
        authors: ['Bogus, A.'],
        year: 2021,
        isRetracted: true,
        retractionReason: 'Clinical trial irregularities found post-publication',
        noticeUrl: 'https://journal.org/retraction/12345',
      },
    ]);

    const docText = 'Prior work by \\cite{discredited2021} has been widely contested.';
    const state = EditorState.create({ doc: docText });
    const view = new EditorView({ state });

    // Position inside 'discredited2021'
    const citePos = docText.indexOf('discredited2021') + 3;
    const tooltip = citationHoverSource(view, citePos);

    expect(tooltip).not.toBeNull();
    const dom = tooltip!.create(view).dom as HTMLElement;

    // 1. Red warning badge in header
    expect(dom.textContent).toContain('THU HỒI / RETRACTED');

    // 2. Alert callout box with official warning header
    expect(dom.textContent).toContain('CẢNH BÁO: BÀI BÁO ĐÃ BỊ THU HỒI');
    expect(dom.textContent).toContain('Clinical trial irregularities');

    // 3. Official publisher notice URL link
    const noticeLink = dom.querySelector('a[href="https://journal.org/retraction/12345"]');
    expect(noticeLink).not.toBeNull();

    // 4. Refactor action button
    expect(dom.textContent).toContain('Đổi tên key (Refactor)');
  });

  it('flags retracted citations with warning diagnostics in runLatexLinter', () => {
    const retractedMap = new Map([
      [
        'badKey2021',
        {
          title: 'Retracted Paper Title',
          reason: 'Plagiarism detected',
          noticeUrl: 'https://notice.org',
        },
      ],
    ]);

    const text = '\\section{Related Work}\nAs described in \\cite{badKey2021}, results showed promise.';
    const diagnostics = runLatexLinter(text, {
      knownBibKeys: ['badKey2021'],
      retractedCitationsMap: retractedMap,
    });

    const retractedDiag = diagnostics.find((d) => d.message.includes('Retracted Paper'));
    expect(retractedDiag).toBeDefined();
    expect(retractedDiag?.severity).toBe('warning');
    expect(retractedDiag?.message).toContain('badKey2021');
    expect(retractedDiag?.message).toContain('Plagiarism detected');
  });
});
