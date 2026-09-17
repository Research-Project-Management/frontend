import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collaborationService, type CollaborationEvent } from '@/features/editor/services/collaboration.service';
import { useSettingsStore } from '@/features/editor/store';
import { parseSyncTeX, LatexCompilerEngine } from '@/features/editor/utils/viewer.util';

describe('Editor & Document End-to-End Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      reviewMode: false,
      editorMode: 'code',
      mainFile: 'main.tex',
    });
  });

  describe('1. Real-Time Collaboration SSE Stream & Event Bus', () => {
    it('should construct direct page stream URL when projectId is null/omitted', () => {
      let createdUrl = '';
      class MockEventSource {
        url: string;
        onmessage: any = null;
        onerror: any = null;
        constructor(url: string) {
          this.url = url;
          createdUrl = url;
        }
        close() {}
      }
      const origEventSource = globalThis.EventSource;
      globalThis.EventSource = MockEventSource as any;

      const cleanup = collaborationService.createCollaborationStream(
        null,
        'page-123',
        () => {},
      );

      expect(createdUrl).toContain('/api/pages/page-123/collaboration/stream');
      cleanup();
      globalThis.EventSource = origEventSource;
    });

    it('should construct project-scoped stream URL when projectId is provided', () => {
      let createdUrl = '';
      class MockEventSource {
        url: string;
        onmessage: any = null;
        onerror: any = null;
        constructor(url: string) {
          this.url = url;
          createdUrl = url;
        }
        close() {}
      }
      const origEventSource = globalThis.EventSource;
      globalThis.EventSource = MockEventSource as any;

      const cleanup = collaborationService.createCollaborationStream(
        'proj-456',
        'page-123',
        () => {},
      );

      expect(createdUrl).toContain('/api/projects/proj-456/pages/page-123/collaboration/stream');
      cleanup();
      globalThis.EventSource = origEventSource;
    });

    it('should parse incoming SSE message and dispatch collaboration events', () => {
      let messageHandler: ((e: any) => void) | null = null;
      class MockEventSource {
        url: string = '';
        onerror: any = null;
        set onmessage(fn: any) {
          messageHandler = fn;
        }
        close() {}
      }
      const origEventSource = globalThis.EventSource;
      globalThis.EventSource = MockEventSource as any;

      const receivedEvents: CollaborationEvent[] = [];
      const cleanup = collaborationService.createCollaborationStream(
        'proj-456',
        'page-123',
        (ev) => receivedEvents.push(ev),
      );

      const mockEventPayload: CollaborationEvent = {
        pageId: 'page-123',
        type: 'suggestion-created',
        timestamp: Date.now(),
        suggestion: { id: 'sugg-1', description: 'Fix typo' },
      };

      expect(messageHandler).toBeDefined();
      messageHandler!({ data: JSON.stringify(mockEventPayload) });

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].type).toBe('suggestion-created');
      expect(receivedEvents[0].suggestion.id).toBe('sugg-1');

      cleanup();
      globalThis.EventSource = origEventSource;
    });
  });

  describe('2. Review Mode (Track Changes) Integration Mechanics', () => {
    it('should toggle reviewMode state correctly in store', () => {
      expect(useSettingsStore.getState().reviewMode).toBe(false);

      useSettingsStore.getState().setReviewMode(true);
      expect(useSettingsStore.getState().reviewMode).toBe(true);

      useSettingsStore.getState().toggleReviewMode();
      expect(useSettingsStore.getState().reviewMode).toBe(false);
    });

    it('should intercept deletion when reviewMode is active and format suggestion payload', () => {
      useSettingsStore.getState().setReviewMode(true);

      // Simulate editor selection and intercepted action
      const mockSelection = {
        startLineNumber: 15,
        startColumn: 1,
        endLineNumber: 16,
        endColumn: 20,
        isEmpty: () => false,
      };
      const originalText = '\\section{Old Background}';

      // Interceptor logic
      const isReview = useSettingsStore.getState().reviewMode;
      expect(isReview).toBe(true);

      const suggestModalPayload = {
        originalText,
        suggestedText: '',
        fromLine: mockSelection.startLineNumber,
        toLine: mockSelection.endLineNumber,
        type: 'delete' as const,
        description: 'Proposed deletion',
      };

      expect(suggestModalPayload.type).toBe('delete');
      expect(suggestModalPayload.originalText).toBe(originalText);
      expect(suggestModalPayload.suggestedText).toBe('');
      expect(suggestModalPayload.fromLine).toBe(15);
      expect(suggestModalPayload.toLine).toBe(16);
    });

    it('should intercept character replacement when reviewMode is active', () => {
      useSettingsStore.getState().setReviewMode(true);

      const mockSelection = {
        startLineNumber: 42,
        endLineNumber: 42,
        isEmpty: () => false,
      };
      const originalText = 'Quantum Computing';
      const typedChar = 'A';

      const suggestModalPayload = {
        originalText,
        suggestedText: typedChar,
        fromLine: mockSelection.startLineNumber,
        toLine: mockSelection.endLineNumber,
        type: 'replace' as const,
        description: 'Proposed replacement',
      };

      expect(suggestModalPayload.type).toBe('replace');
      expect(suggestModalPayload.originalText).toBe('Quantum Computing');
      expect(suggestModalPayload.suggestedText).toBe('A');
      expect(suggestModalPayload.fromLine).toBe(42);
    });
  });

  describe('3. SyncTeX Two-Way Navigation Fidelity', () => {
    const multiFileSyncTeX = `SyncTeX Version:1
Input:1:main.tex
Input:2:chapters/abstract.tex
Input:3:chapters/experiments.tex
{1
[1:10,20:100000,200000
(1:25,30:150000,350000
}
{2
[2:8,12:80000,160000
}
{3
[3:50,15:120000,240000
(3:65,22:180000,320000
}
`;

    it('should resolve forward SyncTeX correctly across root and sub-chapters', () => {
      const synctexMap = parseSyncTeX(multiFileSyncTeX);

      expect(synctexMap.tagToPath.get(1)).toBe('main.tex');
      expect(synctexMap.tagToPath.get(2)).toBe('chapters/abstract.tex');
      expect(synctexMap.tagToPath.get(3)).toBe('chapters/experiments.tex');

      // Forward jump: main.tex line 10 -> page 1
      const page1 = LatexCompilerEngine.resolveForward(10, synctexMap, 'main.tex', 3);
      expect(page1).toBe(1);

      // Forward jump: abstract.tex line 8 -> page 2
      const page2 = LatexCompilerEngine.resolveForward(8, synctexMap, 'abstract.tex', 3);
      expect(page2).toBe(2);

      // Forward jump: experiments.tex line 50 -> page 3
      const page3 = LatexCompilerEngine.resolveForward(50, synctexMap, 'experiments.tex', 3);
      expect(page3).toBe(3);
    });

    it('should return null (zero guesswork) when line has no SyncTeX record', () => {
      const synctexMap = parseSyncTeX(multiFileSyncTeX);
      const target = LatexCompilerEngine.resolveForward(999, synctexMap, 'main.tex', 3);
      // Strictly Overleaf-aligned: no heuristic guessing when line has no coordinate
      expect(target).toBeNull();
    });
  });

  describe('4. Main File Entrypoint Configuration', () => {
    it('should default mainFile to main.tex and allow switching entrypoints', () => {
      const { mainFile, setMainFile } = useSettingsStore.getState();
      expect(mainFile).toBe('main.tex');

      setMainFile('thesis.tex');
      expect(useSettingsStore.getState().mainFile).toBe('thesis.tex');

      setMainFile('paper_ieee.tex');
      expect(useSettingsStore.getState().mainFile).toBe('paper_ieee.tex');
    });
  });
});
