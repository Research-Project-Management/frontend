import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  cleanSourceSnippet,
  SourcesPart,
} from '@/features/ai/ui/parts/SourcesPart';
import type { SourceItem } from '@/features/ai/types/message';

afterEach(() => {
  cleanup();
});

describe('cleanSourceSnippet', () => {
  it('cleans pymupdf4llm table syntax, <br> tags, repeated merged cells, and truncated tags', () => {
    const raw = [
      '|method|Col2|Col3|error (%)|',
      '|---|---|---|---|',
      '|Maxout [9]<br>NIN [25]<br>DSN [24]|Maxout [9]<br>NIN [25]<br>DSN [24]|Maxout [9]<br>NIN [25]<br>DSN [24]|9.38<br>8.81<br>8.22|',
      '||# layers|# params||',
      '|FitNet [34]<br>Highway [41, 42]|19<br>19|2.5M<br>2.3M<br',
    ].join('\n');

    const cleaned = cleanSourceSnippet(raw);
    expect(cleaned).not.toContain('<br');
    expect(cleaned).not.toContain('|---|');
    expect(cleaned).not.toContain('Col2');
    expect(cleaned).toContain(
      'Maxout [9]; NIN [25]; DSN [24] · 9.38; 8.81; 8.22',
    );
    expect(cleaned).toContain('FitNet [34]; Highway [41, 42] · 19; 19 · 2.5M; 2.3M');
    expect(cleaned.match(/Maxout \[9\]/g)?.length).toBe(1);
  });
});

describe('SourcesPart', () => {
  it('groups repeated chunks from the same PDF into one chip with page labels and clean excerpts', () => {
    const title = 'He_Deep_Residual_Learning_CVPR_2016_paper.pdf';
    const sources: SourceItem[] = [
      {
        title,
        source: 'doc-1 (p.6)',
        page: 6,
        snippet:
          '|method|Col2|error (%)|\n|---|---|---|\n|Maxout [9]<br>NIN [25]|Maxout [9]<br>NIN [25]|9.38<br>8.81<br',
      },
      {
        title,
        source: 'doc-1 (p.2)',
        page: 2,
        snippet: '## Residual Learning\nDeep residual nets optimize residual functions.',
      },
      {
        title,
        source: 'doc-1 (p.6)',
        page: 6,
        snippet: 'ResNet-110 achieves 6.43% error on CIFAR-10.',
      },
      {
        title,
        source: 'doc-1 (p.6)',
        page: 6,
        snippet: 'ResNet-1202 has 19.4M parameters.',
      },
      {
        title,
        source: 'doc-1 (p.2)',
        page: 2,
        snippet: 'Shortcut connections add neither extra parameter nor complexity.',
      },
      {
        title,
        source: 'doc-1 (p.2)',
        page: 2,
        snippet: '### Architecture\nVGG-19 inspired 3x3 convolutional layers.',
      },
    ];

    render(<SourcesPart sources={sources} />);

    // 6 raw citations from the same PDF collapse to a single chip
    const triggers = screen.getAllByRole('button', {
      name: /He_Deep_Residual_Learning_CVPR_2016_paper\.pdf/i,
    });
    expect(triggers).toHaveLength(1);
    expect(triggers[0].textContent).toContain('p. 2, 6');

    fireEvent.click(triggers[0]);

    expect(screen.getByText('6 excerpts')).toBeTruthy();
    expect(screen.getAllByText('Page 2')).toHaveLength(3);
    expect(screen.getAllByText('Page 6')).toHaveLength(3);
    expect(
      screen.getByText(/Maxout \[9\]; NIN \[25\] · 9\.38; 8\.81/),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain('<br');
    expect(document.body.textContent).not.toContain('|---|');
  });
});
