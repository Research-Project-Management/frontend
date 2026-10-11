import { describe, it, expect } from 'vitest';
import { buildRetractedCitationMap } from '@/features/editor/domain/citation/retracted-citations';
import { runLatexLinter } from '@/features/editor/domain/latex/latex-linter';
import {
  isItemRetracted,
  getRetractionInfo,
  parseRetractionReasonParts,
} from '@/features/library/utils/retraction';

const retractedItem = {
  title: 'Wakefield MMR',
  doi: '10.1016/S0140-6736(97)11096-0',
  citationKey: 'wakefield1998',
  isRetracted: true,
  retractionNature: 'retraction',
  retractionDetails: {
    reason: 'Data falsification',
    noticeUrl: 'https://doi.org/10.1016/S0140-6736(10)60175-4',
  },
};

describe('isItemRetracted / getRetractionInfo', () => {
  it('accepts every legacy spelling of the flag', () => {
    expect(isItemRetracted({ isRetracted: true })).toBe(true);
    expect(isItemRetracted({ retractionStatus: 'retracted' })).toBe(true);
    expect(isItemRetracted({ is_retracted: true })).toBe(true);
    expect(isItemRetracted({})).toBe(false);
    expect(isItemRetracted(null)).toBe(false);
  });

  it('reads reason and notice link, falling back to the DOI URL', () => {
    expect(getRetractionInfo(retractedItem).reason).toBe('Data falsification');
    expect(
      getRetractionInfo({ isRetracted: true, doi: '10.1/x' }).noticeUrl,
    ).toBe('https://doi.org/10.1/x');
  });
});

describe('buildRetractedCitationMap', () => {
  it('matches project bib entries to retracted library items by DOI (case/URL-insensitive)', () => {
    const map = buildRetractedCitationMap(
      [{ key: 'myKey', type: 'article', doi: 'https://doi.org/10.1016/s0140-6736(97)11096-0' }],
      [retractedItem],
    );
    expect(map.get('myKey')?.reason).toBe('Data falsification');
  });

  it('also registers the library citation key', () => {
    const map = buildRetractedCitationMap([], [retractedItem]);
    expect(map.has('wakefield1998')).toBe(true);
  });

  it('ignores expressions of concern and corrections (retractions only, like Zotero)', () => {
    const map = buildRetractedCitationMap(
      [],
      [
        {
          ...retractedItem,
          retractionNature: 'expression_of_concern',
          retractionDetails: { nature: 'expression_of_concern' },
        },
      ],
    );
    expect(map.size).toBe(0);
  });

  it('drives a RETRACTED_CITATION lint warning on \\cite', () => {
    const map = buildRetractedCitationMap([], [retractedItem]);
    const diags = runLatexLinter('See \\cite{wakefield1998}.', {
      retractedItemsMap: map,
    });
    expect(diags.some((d) => d.code === 'RETRACTED_CITATION')).toBe(true);
  });
});

describe('parseRetractionReasonParts', () => {
  it('splits retraction date and reason cleanly', () => {
    const res = parseRetractionReasonParts(
      "Retracted on June 5, 2020 due to authors' inability to verify authenticity.",
    );
    expect(res.prefix).toBe('Retracted on June 5, 2020:');
    expect(res.body).toBe("Due to authors' inability to verify authenticity.");
  });

  it('splits standard retraction with colon', () => {
    const res = parseRetractionReasonParts('Retracted: Data falsification detected.');
    expect(res.prefix).toBe('Retracted:');
    expect(res.body).toBe('Data falsification detected.');
  });

  it('returns whole text as body when no prefix matches', () => {
    const text = 'This publication has been flagged as retracted.';
    const res = parseRetractionReasonParts(text);
    expect(res.prefix).toBeUndefined();
    expect(res.body).toBe(text);
  });
});
