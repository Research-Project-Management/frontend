import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createVercelThreadEngine } from '@/features/ai/engine/vercel';
import { decodeFluxSseFrame } from '@/features/ai/transport/sse';
import type { AiTransportPort } from '@/features/ai/transport/transport.port';
import type { AiStreamEvent } from '@/features/ai/types/event';
import { WidgetsPart } from '@/features/ai/ui/parts/WidgetsPart';
import type {
  EditorPatchesWidget,
  EditorPatchItem,
  ResponseWidget,
} from '@/features/ai/types/message';

afterEach(() => {
  cleanup();
});

describe('SSE meta widget decoding & EditorPatchesCard', () => {
  it('decodes [META] frames containing editor_patches widgets', () => {
    const events = decodeFluxSseFrame(
      'message',
      `[META]${JSON.stringify({
        agent: 'editor_agent',
        sources: [],
        widgets: [
          {
            type: 'editor_patches',
            title: 'Proposed LaTeX Edit',
            patches: [
              {
                id: 'p-1',
                fileId: 'doc-1',
                filePath: 'sections/method.tex',
                kind: 'replace',
                title: 'Cite Vaswani',
                searchText: 'earlier work',
                replaceText: 'earlier work~\\cite{vaswani2017}',
                fromLine: 12,
                toLine: 12,
              },
            ],
          },
        ],
      })}`,
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('meta');
    if (events[0].type === 'meta') {
      expect(events[0].agent).toBe('editor_agent');
      expect(events[0].widgets).toHaveLength(1);
      expect(events[0].widgets?.[0].type).toBe('editor_patches');
    }
  });

  it('renders EditorPatchesCard with warnings and triggers Review Diff & Apply All callbacks', () => {
    const patches: EditorPatchItem[] = [
      {
        id: 'p1',
        fileId: 'doc-main',
        filePath: 'main.tex',
        kind: 'insert_preamble',
        title: 'Add booktabs package',
        rationale: 'Needed for \\toprule',
        searchText: '\\begin{document}',
        replaceText: '\\usepackage{booktabs}\n\\begin{document}',
        fromLine: 3,
        toLine: 3,
      },
      {
        id: 'p2',
        fileId: 'doc-method',
        filePath: 'sections/method.tex',
        kind: 'replace',
        title: 'Polish equation sentence',
        searchText: 'We use math.',
        replaceText: 'We formulate the objective as follows:',
        fromLine: 10,
        toLine: 12,
        warnings: ["Citation key 'foo2025' not found in project .bib files."],
      },
    ];

    const widgets: ResponseWidget[] = [
      {
        type: 'editor_patches',
        title: 'Proposed LaTeX Edits (2)',
        patches,
      },
    ];

    const onReview = vi.fn();
    const onApplyAll = vi.fn();

    render(
      <WidgetsPart
        widgets={widgets}
        onReviewEditorPatch={onReview}
        onApplyAllEditorPatches={onApplyAll}
      />,
    );

    expect(screen.getByText('Proposed LaTeX Edits (2)')).toBeInTheDocument();
    expect(screen.getByText('main.tex')).toBeInTheDocument();
    expect(screen.getByText('sections/method.tex')).toBeInTheDocument();
    expect(screen.getByText('L10-12')).toBeInTheDocument();
    expect(
      screen.getByText("Citation key 'foo2025' not found in project .bib files."),
    ).toBeInTheDocument();

    const reviewButtons = screen.getAllByRole('button', { name: /Review Diff/i });
    expect(reviewButtons).toHaveLength(2);
    fireEvent.click(reviewButtons[1]);
    expect(onReview).toHaveBeenCalledWith(patches[1]);

    const applyAllBtn = screen.getByRole('button', { name: /Apply All/i });
    fireEvent.click(applyAllBtn);
    expect(onApplyAll).toHaveBeenCalledWith(patches);
  });

  it('decodes [ACTION] editor_patch_preview frames and toggles Live preview badge by streaming state', () => {
    const events = decodeFluxSseFrame(
      'message',
      `[ACTION]${JSON.stringify({
        type: 'editor_patch_preview',
        agent: 'editor_agent',
        totalPatches: 1,
        patch: {
          id: 'p-stream-1',
          fileId: 'doc-1',
          filePath: 'main.tex',
          kind: 'replace',
          title: 'Fix missing brace',
          searchText: '\\section{Intro',
          replaceText: '\\section{Intro}',
          fromLine: 4,
          toLine: 4,
        },
      })}`,
    );

    expect(events).toEqual([
      {
        type: 'editor-patch-preview',
        agent: 'editor_agent',
        totalPatches: 1,
        patch: {
          id: 'p-stream-1',
          fileId: 'doc-1',
          filePath: 'main.tex',
          kind: 'replace',
          title: 'Fix missing brace',
          searchText: '\\section{Intro',
          replaceText: '\\section{Intro}',
          fromLine: 4,
          toLine: 4,
        },
      },
    ]);

    const liveWidget: EditorPatchesWidget = {
      type: 'editor_patches',
      title: 'Proposed LaTeX Edit',
      patches: [
        {
          id: 'p-stream-1',
          fileId: 'doc-1',
          filePath: 'main.tex',
          kind: 'replace',
          title: 'Fix missing brace',
          searchText: '\\section{Intro',
          replaceText: '\\section{Intro}',
        },
      ],
      streaming: true,
    };

    const { rerender } = render(<WidgetsPart widgets={[liveWidget]} />);
    expect(screen.getByText('Live preview')).toBeInTheDocument();

    rerender(<WidgetsPart widgets={[{ ...liveWidget, streaming: false }]} />);
    expect(screen.queryByText('Live preview')).not.toBeInTheDocument();
  });

  it('reconciles progressive editor-patch-preview events with final meta widgets without duplication', async () => {
    const patch1: EditorPatchItem = {
      id: 'p-1',
      fileId: 'doc-main',
      filePath: 'main.tex',
      kind: 'insert_preamble',
      title: 'Add booktabs',
      searchText: '\\begin{document}',
      replaceText: '\\usepackage{booktabs}\n\\begin{document}',
      fromLine: 3,
      toLine: 3,
    };
    const patch2: EditorPatchItem = {
      id: 'p-2',
      fileId: 'doc-method',
      filePath: 'sections/method.tex',
      kind: 'replace',
      title: 'Cite Vaswani',
      searchText: 'earlier work',
      replaceText: 'earlier work~\\cite{vaswani2017}',
      fromLine: 8,
      toLine: 8,
    };

    const transport: AiTransportPort = {
      async stream() {
        async function* gen(): AsyncGenerator<AiStreamEvent> {
          yield {
            type: 'editor-patch-preview',
            agent: 'editor_agent',
            totalPatches: 1,
            patch: patch1,
          };
          yield {
            type: 'editor-patch-preview',
            agent: 'editor_agent',
            totalPatches: 2,
            patch: patch2,
          };
          yield { type: 'text-delta', delta: 'Two LaTeX patches prepared.' };
          yield {
            type: 'meta',
            agent: 'editor_agent',
            widgets: [
              {
                type: 'editor_patches',
                title: 'Proposed LaTeX Edits (2)',
                patches: [patch1, patch2],
              },
            ],
          };
          yield { type: 'done' };
        }
        return { chatIdHeader: 'ed-stream-1', events: gen() };
      },
      async resume() {
        async function* empty(): AsyncGenerator<AiStreamEvent> {
          yield { type: 'done' };
        }
        return { events: empty() };
      },
      cancel: vi.fn().mockResolvedValue(undefined),
    };

    const engine = createVercelThreadEngine(
      { threadKey: 'draft:ed-p3', spaceId: 'sp-1', mode: 'editor' },
      transport,
    );

    const sawLiveStreamingState: boolean[] = [];
    const unsubscribe = engine.subscribe(() => {
      const assistant = engine
        .getSnapshot()
        .messages.find((m) => m.role === 'assistant');
      const widgetPart = assistant?.parts.find((p) => p.type === 'widgets');
      if (widgetPart?.type === 'widgets') {
        const w = widgetPart.widgets[0];
        if (w?.type === 'editor_patches' && w.streaming) {
          sawLiveStreamingState.push(true);
        }
      }
    });

    await engine.send('Add booktabs and cite Vaswani');
    unsubscribe();

    expect(sawLiveStreamingState.length).toBeGreaterThan(0);
    const snap = engine.getSnapshot();
    const assistant = snap.messages.find((m) => m.role === 'assistant');
    const widgetParts = assistant?.parts.filter((p) => p.type === 'widgets') ?? [];
    expect(widgetParts).toHaveLength(1);
    const finalizedWidget = widgetParts[0];
    expect(finalizedWidget.type).toBe('widgets');
    if (finalizedWidget.type === 'widgets') {
      expect(finalizedWidget.widgets).toHaveLength(1);
      const card = finalizedWidget.widgets[0];
      expect(card.type).toBe('editor_patches');
      if (card.type === 'editor_patches') {
        expect(card.streaming).toBeUndefined();
        expect(card.patches.map((p) => p.id)).toEqual(['p-1', 'p-2']);
      }
    }
  });
});
