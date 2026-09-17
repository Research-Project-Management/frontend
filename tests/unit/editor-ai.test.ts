import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useDocumentEditorStore } from '@/features/editor/store/editor.store';
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

  describe('2. Monaco Editor Insertion & Replacement Bridge', () => {
    it('should execute edits to insert generated LaTeX code at current cursor', () => {
      const mockExecuteEdits = vi.fn();
      const mockFocus = vi.fn();
      const mockSelection = {
        startLineNumber: 10,
        startColumn: 1,
        endLineNumber: 10,
        endColumn: 1,
      };

      const mockEditor = {
        getSelection: vi.fn().mockReturnValue(mockSelection),
        executeEdits: mockExecuteEdits,
        focus: mockFocus,
      };

      useDocumentEditorStore.setState({
        editorRef: { current: mockEditor as any },
      });

      const currentEditor = useDocumentEditorStore.getState().editorRef.current;
      expect(currentEditor).toBeTruthy();

      const generatedLatex = '\\section{Methodology}\nProposed novel approach...';
      const selection = currentEditor!.getSelection();

      currentEditor!.executeEdits('ai-assistant', [
        {
          range: selection!,
          text: generatedLatex,
          forceMoveMarkers: true,
        },
      ]);
      currentEditor!.focus();

      expect(mockExecuteEdits).toHaveBeenCalledWith('ai-assistant', [
        {
          range: mockSelection,
          text: generatedLatex,
          forceMoveMarkers: true,
        },
      ]);
      expect(mockFocus).toHaveBeenCalled();
    });

    it('should replace highlighted selection with updated LaTeX code', () => {
      const mockExecuteEdits = vi.fn();
      const mockRange = {
        startLineNumber: 5,
        startColumn: 1,
        endLineNumber: 7,
        endColumn: 20,
      };

      const mockEditor = {
        getSelection: vi.fn().mockReturnValue(mockRange),
        executeEdits: mockExecuteEdits,
        focus: vi.fn(),
      };

      useDocumentEditorStore.setState({
        editorRef: { current: mockEditor as any },
      });

      const editor = useDocumentEditorStore.getState().editorRef.current;
      const polishedLatex = '\\textbf{Revised formal academic content.}';

      editor!.executeEdits('ai-assistant', [
        {
          range: editor!.getSelection() as any,
          text: polishedLatex,
          forceMoveMarkers: true,
        },
      ]);

      expect(mockExecuteEdits).toHaveBeenCalledWith('ai-assistant', [
        {
          range: mockRange,
          text: polishedLatex,
          forceMoveMarkers: true,
        },
      ]);
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
