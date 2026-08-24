'use client';

import { useState, useRef, useCallback } from 'react';
import { streamPaperCopilotChat } from '../../services/copilot.service';
import type { CopilotMessage, CopilotCitation } from '../../types/copilot.types';

export interface UseCopilotChatProps {
  paperId: string;
  initialMessages?: CopilotMessage[];
  onNavigateToPage?: (pageNumber: number) => void;
}

export function useCopilotChat({
  paperId,
  initialMessages = [],
  onNavigateToPage,
}: UseCopilotChatProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    stopStreaming();
    setMessages([]);
  }, [stopStreaming]);

  const sendMessage = useCallback(
    async (overrideText?: string, selectionContext?: { text: string; pageNumber: number }) => {
      const textToSend = (overrideText ?? input).trim();
      if (!textToSend || isStreaming) return;

      const userMessageId = `msg-${Date.now()}`;
      const assistantMessageId = `msg-${Date.now() + 1}`;

      const userMsg: CopilotMessage = {
        id: userMessageId,
        role: 'user',
        content: textToSend,
        timestamp: new Date().toISOString(),
      };

      const assistantMsg: CopilotMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };

      const newHistory = [...messages, userMsg];
      setMessages([...newHistory, assistantMsg]);
      if (!overrideText) setInput('');
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const stream = streamPaperCopilotChat(
          paperId,
          newHistory.map((msg) => ({ role: msg.role, content: msg.content })),
          {
            selection: selectionContext,
            signal: controller.signal,
            onCitation: (citations: CopilotCitation[]) => {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (!last || last.role !== 'assistant') return prev;
                return [
                  ...prev.slice(0, -1),
                  {
                    ...last,
                    citations,
                  },
                ];
              });
            },
          },
        );

        for await (const chunk of stream) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: last.content + chunk,
              },
            ];
          });
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          // User aborted stream
        } else {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content:
                  last.content +
                  '\n\n*[Error: Could not retrieve response from Paper Copilot. Please try again.]*',
                isStreaming: false,
              },
            ];
          });
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last || last.role !== 'assistant') return prev;
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              isStreaming: false,
            },
          ];
        });
      }
    },
    [input, isStreaming, messages, paperId],
  );

  const handleCitationClick = useCallback(
    (pageNumber: number) => {
      if (pageNumber && onNavigateToPage) {
        onNavigateToPage(pageNumber);
      }
    },
    [onNavigateToPage],
  );

  return {
    messages,
    input,
    setInput,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    handleCitationClick,
  };
}
