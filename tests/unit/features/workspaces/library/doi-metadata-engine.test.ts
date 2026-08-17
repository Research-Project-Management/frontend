import { describe, it, expect } from 'vitest';
import {
  DoiMetadataEngine,
  extractDoiFromText,
  normalizeDoi,
  extractArxivId,
} from '@/features/workspaces/library/utils/library.util';

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
});
