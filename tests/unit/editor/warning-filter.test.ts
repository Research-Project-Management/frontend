import { describe, it, expect } from 'vitest';
import {
  shouldSuppressWarning,
  filterDiagnostics,
  type WarningFilterOptions,
} from '@/features/editor/domain/compiler/warning-filter';

describe('warning-filter domain logic', () => {
  it('never suppresses compiler errors regardless of options', () => {
    const errorItem = {
      message: 'Overfull \\hbox (15.4pt too wide) in paragraph at lines 42--45',
      severity: 'error' as const,
    };
    const options: WarningFilterOptions = {
      suppressBadBoxes: true,
      suppressFontWarnings: true,
      suppressPackageWarnings: true,
      customPatterns: ['Overfull'],
    };

    expect(shouldSuppressWarning(errorItem, options)).toBe(false);
    expect(filterDiagnostics([errorItem], options)).toEqual([errorItem]);
  });

  it('correctly suppresses bad boxes when suppressBadBoxes is true', () => {
    const items = [
      { message: 'Overfull \\hbox (12.3pt too wide) detected at line 10', severity: 'warning' },
      { message: 'Underfull \\vbox (badness 10000) has occurred at line 55', severity: 'warning' },
      { message: 'Undefined control sequence \\foobar', severity: 'warning' },
    ];

    const filtered = filterDiagnostics(items, { suppressBadBoxes: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].message).toBe('Undefined control sequence \\foobar');
  });

  it('correctly suppresses font warnings when suppressFontWarnings is true', () => {
    const items = [
      { message: 'LaTeX Font Warning: Font shape `TU/ptm/m/n\' undefined', severity: 'warning' },
      { message: 'LaTeX Font Warning: Some font shapes were not available, defaults used.', severity: 'warning' },
      { message: 'Reference `fig:architecture` on page 3 undefined', severity: 'warning' },
    ];

    const filtered = filterDiagnostics(items, { suppressFontWarnings: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].message).toContain('Reference `fig:architecture`');
  });

  it('correctly suppresses package warnings when suppressPackageWarnings is true', () => {
    const items = [
      { message: 'Package hyperref Warning: Token not allowed in a PDF string', severity: 'warning' },
      { message: 'Class article Warning: Unused option foo', severity: 'warning' },
      { message: 'Citation `einstein1905` on page 1 undefined', severity: 'warning' },
    ];

    const filtered = filterDiagnostics(items, { suppressPackageWarnings: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].message).toContain('Citation `einstein1905`');
  });

  it('supports custom substring patterns', () => {
    const items = [
      { message: 'Citation `smith2024` on page 1 undefined', severity: 'warning' },
      { message: 'Reference `sec:intro` undefined', severity: 'warning' },
      { message: 'Missing $ inserted', severity: 'warning' },
    ];

    const filtered = filterDiagnostics(items, {
      customPatterns: ['Citation', 'sec:intro'],
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].message).toBe('Missing $ inserted');
  });

  it('supports custom regex patterns (/pattern/flags)', () => {
    const items = [
      { message: 'Float too large for page by 42.0pt', severity: 'warning' },
      { message: 'marginpar on page 2 moved', severity: 'warning' },
      { message: 'Normal warning message', severity: 'warning' },
    ];

    const filtered = filterDiagnostics(items, {
      customPatterns: ['/float too large/i', '/marginpar.*moved/i'],
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].message).toBe('Normal warning message');
  });

  it('returns exact original array if all options are disabled or empty', () => {
    const items = [
      { message: 'Overfull \\hbox', severity: 'warning' },
      { message: 'Font shape undefined', severity: 'warning' },
    ];

    const result = filterDiagnostics(items, {});
    expect(result).toBe(items);
  });
});
