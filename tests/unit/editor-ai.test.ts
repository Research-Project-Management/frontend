import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useDocumentEditorStore } from '@/features/editor/store/editor.store';
import { CodeMirrorEngineAdapter } from '@/features/editor/adapters/codemirror/codemirror.adapter';
import { getPageChat, clearPageChat, streamEditorChat } from '@/features/ai/services/chat.service';

describe('Editor AI Assistant (Copilot) Subsystem Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDocumentEditorStore.getState().resetPageState();
  });

  describe('1. Editor Event Bus & Selection Context Bridge', () => {
    it('should emit and receive flux:open-ai-panel with selectedText context', () => {
      const handler = vi.fn();
      const unsubscribe = EditorEventBus.on('flux:open-ai-panel', handler);

      EditorEventBus.emit('flux:open-ai-panel', {
        selectedText: '\\begin{equation}\nE = mc^2\n\\end{equation}',
        initialPrompt: 'Explain this formula',
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        selectedText: '\\begin{equation}\nE = mc^2\n\\end{equation}',
        initialPrompt: 'Explain this formula',
      });

      unsubscribe();
    });

    it('should emit and receive flux:toggle-ai-panel correctly', () => {
      const handler = vi.fn();
      const unsubscribe = EditorEventBus.on('flux:toggle-ai-panel', handler);

      EditorEventBus.emit('flux:toggle-ai-panel');

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

  describe('3. Page Chat Service & Streaming API Integration', () => {
    it('should call page chat endpoint with correct URL and headers', async () => {
      const mockMessages = [
        { role: 'user', content: 'What is this section about?' },
        { role: 'assistant', content: 'This section details the theorem.' },
      ];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: mockMessages }),
      } as any);

      const result = await getPageChat('page-abc-123');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai/page-chats/page-abc-123'),
        expect.objectContaining({
          credentials: 'include',
        }),
      );
      expect(result).toEqual(mockMessages);
    });

    it('should delete page chat thread via clearPageChat', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as any);

      await clearPageChat('page-abc-123');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai/page-chats/page-abc-123'),
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });

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
        body: mockStream,
      } as any);

      const received: string[] = [];
      const generator = streamEditorChat(
        [{ role: 'user', content: 'Generate equation' }],
        {
          projectId: 'proj-1',
          filename: 'main.tex',
          fileContent: '\\documentclass{article}',
        },
      );

      for await (const chunk of generator) {
        received.push(chunk);
      }

      expect(received.join('')).toBe('Here is the LaTeX equation:');
    });
  });
});
