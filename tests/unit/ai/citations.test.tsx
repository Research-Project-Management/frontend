import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  buildCitationLookup,
  formatInlineCitationLabel,
  preprocessCitationMarkdown,
} from '@/features/ai/ui/parts/citations';
import { MessageParts } from '@/features/ai/ui/parts/MessageParts';
import type { FluxMessage, SourceItem } from '@/features/ai/types/message';

afterEach(() => {
  cleanup();
});

describe('preprocessCitationMarkdown', () => {
  const byIndex = new Map<number, SourceItem>([
    [1, { index: 1, title: 'ResNet.pdf', source: 'doc-1 (p.2)', page: 2 }],
    [2, { index: 2, title: 'ResNet.pdf', source: 'doc-1 (p.6)', page: 6 }],
    [6, { index: 6, title: 'ResNet.pdf', source: 'doc-1 (p.6)', page: 6 }],
  ]);

  it('converts canonical [[cite:6]] and [[cite:1, 2]] markers into internal citation links', () => {
    const out = preprocessCitationMarkdown(
      'ResNet-56 đạt lỗi 6.97% [[cite:6]] và dùng shortcut [[cite:1, 2]].',
      { byIndex, isStreaming: false },
    );
    expect(out).toContain('[6](#flux-cite-6)');
    expect(out).toContain('[1](#flux-cite-1) [2](#flux-cite-2)');
    expect(out).not.toContain('[[cite:');
  });

  it('strips partial trailing [[cite markers only while streaming', () => {
    const streaming = preprocessCitationMarkdown(
      'Đang trình bày kết quả [[cit',
      { byIndex, isStreaming: true },
    );
    expect(streaming).toBe('Đang trình bày kết quả ');

    const finished = preprocessCitationMarkdown(
      'Kết quả [[cite:99]] chưa có nguồn.',
      { byIndex, isStreaming: false },
    );
    expect(finished).toBe('Kết quả chưa có nguồn.');
  });

  it('keeps orphan punctuation tidy and tightens space before punctuation after citations', () => {
    const out = preprocessCitationMarkdown(
      'Dữ liệu bổ sung [[cite:99]]. Tiếp theo [[cite:6]] .',
      { byIndex, isStreaming: false },
    );
    expect(out).toBe('Dữ liệu bổ sung. Tiếp theo [6](#flux-cite-6).');
  });

  it('collapses consecutive citations resolving to the same label while preserving distinct pages', () => {
    const samePageMap = new Map<number, SourceItem>([
      [1, { index: 1, title: 'ResNet.pdf', source: 'doc-1 (p.7)', page: 7 }],
      [3, { index: 3, title: 'ResNet.pdf', source: 'doc-1 (p.9)', page: 9 }],
      [4, { index: 4, title: 'ResNet.pdf', source: 'doc-1 (p.9)', page: 9 }],
      [5, { index: 5, title: 'ResNet.pdf', source: 'doc-1 (p.9)', page: 9 }],
    ]);

    const legacyOut = preprocessCitationMarkdown(
      'Các đoạn [1], [3], [4], [5] liên quan.',
      { byIndex: samePageMap, isStreaming: false },
    );
    expect(legacyOut).toBe('Các đoạn [1](#flux-cite-1), [3](#flux-cite-3) liên quan.');

    const canonicalOut = preprocessCitationMarkdown(
      'Kết luận [[cite:1]][[cite:3]][[cite:4]][[cite:5]] .',
      { byIndex: samePageMap, isStreaming: false },
    );
    expect(canonicalOut).toBe('Kết luận [1](#flux-cite-1)[3](#flux-cite-3).');
  });

  it('preserves code blocks, inline code, math, and regular links verbatim', () => {
    const input = [
      'Inline code `[[cite:6]]` and math $a[1] + x_[[cite:2]]$ and [site](https://example.com).',
      '```ts',
      'const x = arr[[cite:1]];',
      '```',
      'Prose [[cite:6]].',
    ].join('\n');

    const out = preprocessCitationMarkdown(input, { byIndex, isStreaming: false });
    expect(out).toContain('`[[cite:6]]`');
    expect(out).toContain('$a[1] + x_[[cite:2]]$');
    expect(out).toContain('[site](https://example.com)');
    expect(out).toContain('const x = arr[[cite:1]];');
    expect(out).toContain('Prose [6](#flux-cite-6).');
  });

  it('falls back to legacy [2] brackets while keeping out-of-range paper refs like Maxout [9] literal', () => {
    const out = preprocessCitationMarkdown(
      'Thấp hơn Maxout [9] và NIN [25] trên CIFAR-10 [2].',
      { byIndex, isStreaming: false },
    );
    expect(out).toContain('Maxout [9]');
    expect(out).toContain('NIN [25]');
    expect(out).toContain('[2](#flux-cite-2).');
    expect(out).not.toContain('#flux-cite-9');
  });
});

describe('formatInlineCitationLabel', () => {
  it('formats single-doc PDF as p. N, multi-doc as ShortTitle · p. N, web as hostname, and no-page as N', () => {
    const singlePdf: SourceItem = {
      index: 6,
      title: 'He_Deep_Residual_Learning_CVPR_2016_paper.pdf',
      source: 'doc-1 (p.6)',
      page: 6,
    };
    expect(
      formatInlineCitationLabel(singlePdf, { isMultiDocument: false, fallbackIndex: 6 }),
    ).toBe('p. 6');
    expect(
      formatInlineCitationLabel(singlePdf, { isMultiDocument: true, fallbackIndex: 6 }),
    ).toBe('He Deep Residual… · p. 6');

    const webSource: SourceItem = {
      index: 1,
      title: 'ArXiv Paper',
      url: 'https://www.arxiv.org/abs/1512.03385',
    };
    expect(
      formatInlineCitationLabel(webSource, { isMultiDocument: true, fallbackIndex: 1 }),
    ).toBe('arxiv.org');

    const noPagePdf: SourceItem = {
      index: 3,
      title: 'Notes.md',
      source: 'doc-3',
    };
    expect(
      formatInlineCitationLabel(noPagePdf, { isMultiDocument: false, fallbackIndex: 3 }),
    ).toBe('3');
  });

  it('builds lookup cleanly for both indexed and legacy sources', () => {
    const lookup = buildCitationLookup([
      { index: 6, title: 'ResNet.pdf', source: 'doc-1 (p.6)', page: 6 },
    ]);
    expect(lookup.isMultiDocument).toBe(false);
    expect(lookup.byIndex.get(6)?.page).toBe(6);
    expect(lookup.byIndex.get(1)).toBeUndefined();
  });
});

describe('MessageParts interactive inline citations', () => {
  it('renders interactive inline pill for [[cite:6]] with cleaned popover excerpt while keeping Maxout [9] plain', () => {
    const sources: SourceItem[] = [
      {
        index: 6,
        title: 'He_Deep_Residual_Learning_CVPR_2016_paper.pdf',
        source: 'doc-1 (p.6)',
        page: 6,
        snippet:
          '|method|Col2|error (%)|\n|---|---|---|\n|Maxout [9]<br>NIN [25]|Maxout [9]<br>NIN [25]|9.38<br>8.81<br',
      },
    ];
    const message: FluxMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: 'ResNet-56 tốt hơn Maxout [9] trên CIFAR-10 [[cite:6]].',
      parts: [
        {
          type: 'text',
          text: 'ResNet-56 tốt hơn Maxout [9] trên CIFAR-10 [[cite:6]].',
        },
        {
          type: 'sources',
          sources,
        },
      ],
      sources,
    };

    render(<MessageParts message={message} />);

    // Raw marker must never leak into rendered text
    expect(document.body.textContent).not.toContain('[[cite:');
    expect(document.body.textContent).toContain('Maxout [9]');

    const inlineTrigger = screen.getByRole('button', {
      name: /View source: He_Deep_Residual_Learning_CVPR_2016_paper\.pdf/i,
    });
    expect(inlineTrigger.textContent).toBe('p. 6');

    fireEvent.click(inlineTrigger);

    expect(screen.getByText('Page 6')).toBeTruthy();
    expect(
      screen.getByText(/Maxout \[9\]; NIN \[25\] · 9\.38; 8\.81/),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain('<br');
  });
});
