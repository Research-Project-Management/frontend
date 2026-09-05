import { describe, it, expect, vi } from 'vitest';
import {
  DoiMetadataEngine,
  extractDoiFromText,
  normalizeDoi,
  extractArxivId,
} from '@/features/workspaces/library/utils/library.util';

vi.mock('@/features/workspaces/library/services/citation.service', () => ({
  resolveAcademicQuery: vi.fn().mockResolvedValue({
    provider: 'CrossRef',
    queryType: 'DOI',
    metadata: {
      title: 'Complete provider record',
      authors: ['Ada Lovelace'],
      editors: ['Charles Babbage'],
      keywords: ['metadata', 'pdf'],
      citationKey: 'lovelace1843',
      rights: 'CC BY',
      license: 'https://creativecommons.org/licenses/by/4.0/',
      extraFields: { sourceRecord: 'crossref-1' },
      year: 1843,
    },
  }),
  fetchReferenceByDoi: vi.fn().mockResolvedValue(null),
  searchReferences: vi.fn(),
}));

import { extractMetadata } from '@/features/workspaces/library/utils/library.util';

describe('DoiMetadataEngine Deep Module', () => {
  it('extracts DOIs accurately from dirty strings and surrounding punctuation', () => {
    // Standard DOI
    expect(extractDoiFromText('The DOI is 10.1038/nature12373 in text')).toBe('10.1038/nature12373');

    // Trailing punctuation
    expect(extractDoiFromText('See ref (10.1016/j.cell.2020.08.012).')).toBe('10.1016/j.cell.2020.08.012');
    expect(extractDoiFromText('Available at [10.1145/3377325.3377498]!')).toBe('10.1145/3377325.3377498');

    // Inside full URL
    expect(extractDoiFromText('https://doi.org/10.1109/CVPR.2016.90')).toBe('10.1109/CVPR.2016.90');

    // No DOI present
    expect(extractDoiFromText('There is no identifier in this string.')).toBeNull();
  });

  it('normalizes DOIs across varied URL and prefix formats', () => {
    expect(normalizeDoi('https://doi.org/10.1000/182')).toBe('10.1000/182');
    expect(normalizeDoi('http://dx.doi.org/10.1000/182')).toBe('10.1000/182');
    expect(normalizeDoi('doi: 10.1000/182')).toBe('10.1000/182');
    expect(normalizeDoi('10.1000/182')).toBe('10.1000/182');
    expect(normalizeDoi('')).toBeNull();
  });

  it('extracts ArXiv identifiers correctly', () => {
    expect(extractArxivId('arXiv:2305.18290v2')).toBe('2305.18290v2');
    expect(extractArxivId('Preprint at 2106.09685.')).toBe('2106.09685');
    expect(extractArxivId('No arxiv here')).toBeNull();
  });

  it('preserves provider metadata fields during PDF extraction', async () => {
    const result = await extractMetadata(
      new File(['%PDF-1.7'], 'complete-paper.pdf', { type: 'application/pdf' }),
    );

    expect(result).toMatchObject({
      title: 'Complete provider record',
      authors: ['Ada Lovelace'],
      editors: ['Charles Babbage'],
      keywords: ['metadata', 'pdf'],
      citationKey: 'lovelace1843',
      rights: 'CC BY',
      license: 'https://creativecommons.org/licenses/by/4.0/',
      extraFields: { sourceRecord: 'crossref-1', provider: 'CrossRef' },
    });
  });

  it('does not fail PDF metadata extraction when CrossRef returns 404', async () => {
    const { resolveAcademicQuery, fetchReferenceByDoi } = await import(
      '@/features/workspaces/library/services/citation.service'
    );
    vi.mocked(resolveAcademicQuery).mockRejectedValueOnce(
      Object.assign(new Error('DOI not found on CrossRef (404)'), {
        statusCode: 404,
      }),
    );
    vi.mocked(fetchReferenceByDoi).mockRejectedValueOnce(
      Object.assign(new Error('DOI not found on CrossRef (404)'), {
        statusCode: 404,
      }),
    );

    await expect(
      extractMetadata(
        new File(['%PDF-1.7'], '10.9999/not-found.pdf', {
          type: 'application/pdf',
        }),
      ),
    ).resolves.toMatchObject({ title: '10.9999/not-found' });
  });
});
