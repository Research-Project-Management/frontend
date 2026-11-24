import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { usePageStore, editorCommandBus } from '@/features/editor/core';
import { CodeMirrorEngineAdapter } from '@/features/editor/core/engine/adapters/codemirror.adapter';
import { fluxTransport } from '@/features/ai';

describe('Editor AI Assistant (Copilot) Subsystem Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePageStore.getState().resetPageState();
  });

  describe('1. Editor Command Bus & Selection Context Bridge', () => {
    it('should emit and receive sidebar:open-ai-panel with selectedText context', () => {
      const handler = vi.fn();
      const unsubscribe = editorCommandBus.subscribe('sidebar:open-ai-panel', handler);

      editorCommandBus.dispatch({
        type: 'sidebar:open-ai-panel',
        selectedText: '\\begin{equation}\nE = mc^2\n\\end{equation}',
        initialPrompt: 'Explain this formula',
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        type: 'sidebar:open-ai-panel',
        selectedText: '\\begin{equation}\nE = mc^2\n\\end{equation}',
        initialPrompt: 'Explain this formula',
      });

      unsubscribe();
    });

    it('should emit and receive sidebar:toggle-ai-panel correctly', () => {
      const handler = vi.fn();
      const unsubscribe = editorCommandBus.subscribe('sidebar:toggle-ai-panel', handler);

      editorCommandBus.dispatch({ type: 'sidebar:toggle-ai-panel' });

      expect(handler).toHaveBeenCalledTimes(1);
      unsubscribe();
    });
  });

  describe('2. CodeMirror Editor Insertion & Replacement Bridge', () => {
    it('should execute edits to insert generated LaTeX code at current cursor via CodeMirrorEngineAdapter', () => {
      const container = document.createElement('div');
      const state = EditorState.create({
        doc: '\\documentclass{article}\n\\begin{document}\n\n\\end{document}',
      });
      const view = new EditorView({ state, parent: container });
      const adapter = new CodeMirrorEngineAdapter(view);

      // Position cursor at line 3 (offset 39)
      view.dispatch({ selection: { anchor: 39 } });
      const generatedLatex = '\\section{Methodology}\nProposed novel approach...';
      adapter.insertText(generatedLatex);

      expect(adapter.getContent()).toContain(generatedLatex);
      view.destroy();
      container.remove();
    });

    it('should replace highlighted selection with updated LaTeX code via CodeMirrorEngineAdapter', () => {
      const container = document.createElement('div');
      const state = EditorState.create({
        doc: 'Initial draft content to be polished.',
      });
      const view = new EditorView({ state, parent: container });
      const adapter = new CodeMirrorEngineAdapter(view);

      // Select "Initial draft content" (offsets 0 to 21)
      view.dispatch({ selection: { anchor: 0, head: 21 } });
      const polishedLatex = '\\textbf{Revised formal academic content}';
      adapter.insertText(polishedLatex);

      expect(adapter.getContent()).toBe('\\textbf{Revised formal academic content} to be polished.');
      view.destroy();
      container.remove();
    });
  });

  describe('3. Streaming API Integration', () => {
    it('should stream editor chat chunks over SSE body', async () => {
      const encoder = new TextEncoder();
      const chunks = [
        'data: {"type":"content","content":"Here is the "}\n\n',
        'data: {"type":"content","content":"LaTeX equation:"}\n\n',
        'data: [DONE]\n\n',
      ];

      let chunkIndex = 0;
      const mockStream = new ReadableStream({
        pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(encoder.encode(chunks[chunkIndex++]));
          } else {
            controller.close();
          }
        },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        body: mockStream,
      } as any);

      const received: string[] = [];
      const streamResult = await fluxTransport.stream({
        messages: [{ role: 'user', content: 'Generate equation' }],
        context: {
          mode: 'editor',
          spaceId: 'proj-1',
          editor: {
            filename: 'main.tex',
            fileContent: '\\documentclass{article}',
          },
        },
      });

      for await (const ev of streamResult.events) {
        if (ev.type === 'text-delta') {
          received.push(ev.delta);
        }
      }

      expect(received.join('')).toBe('Here is the LaTeX equation:');
    });
  });
});
