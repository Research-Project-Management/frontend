'use client';

import { useState, useRef, useCallback } from 'react';
import { AiService } from '../services/ai.service';
import type { CopilotMessage, CopilotCitation } from '../types/reader.types';

export interface UseCopilotProps {
  paperId: string;
  initialMessages?: CopilotMessage[];
  onNavigateToPage?: (pageNumber: number) => void;
}

export function useCopilot({
  paperId,
  initialMessages = [],
  onNavigateToPage,
}: UseCopilotProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>(initialMessages);
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
    async (content: string, selectionContext?: { text: string; pageNumber: number }) => {
      const textToSend = content.trim();
      if (!textToSend || isStreaming) return;

      const userMessage: CopilotMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: textToSend,
        timestamp: new Date().toISOString(),
      };

      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: CopilotMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const historyForBackend = [
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user' as const, content: textToSend },
        ];

        let accumulatedText = '';
        let citationsCaptured: CopilotCitation[] = [];

        const stream = AiService.streamPaperChat(
          paperId,
          historyForBackend,
          {
            selection: selectionContext,
            onCitation: (citations) => {
              citationsCaptured = citations;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, citations }
                    : msg,
                ),
              );
            },
            signal: abortController.signal,
          },
        );

        for await (const chunk of stream) {
          accumulatedText += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulatedText }
                : msg,
            ),
          );
        }

        let finalCitations = citationsCaptured;
        if (finalCitations.length === 0 && accumulatedText) {
          const pageRegex = /\[p\.?\s*(\d+)\]|\(p\.?\s*(\d+)\)|\[trang\s*(\d+)\]|\[page\s*(\d+)\]/gi;
          const foundPages = new Set<number>();
          let match: RegExpExecArray | null;
          while ((match = pageRegex.exec(accumulatedText)) !== null) {
            const numStr = match[1] || match[2] || match[3] || match[4];
            const pageNum = parseInt(numStr, 10);
            if (!isNaN(pageNum) && pageNum > 0 && pageNum < 500) {
              foundPages.add(pageNum);
            }
          }
          if (foundPages.size > 0) {
            finalCitations = Array.from(foundPages)
              .sort((a, b) => a - b)
              .map((pageNumber) => ({ pageNumber }));
          }
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  isStreaming: false,
                  citations:
                    finalCitations.length > 0 ? finalCitations : msg.citations,
                }
              : msg,
          ),
        );
      } catch (err: unknown) {
        const isAborted = (err as { name?: string })?.name === 'AbortError';
        if (!isAborted) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    isStreaming: false,
                    content:
                      msg.content ||
                      'Connection error. Please try asking again.',
                  }
                : msg,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, messages, paperId],
  );

  const handleCitationClick = useCallback(
    (pageNumber: number) => {
      if (pageNumber && onNavigateToPage) {
        onNavigateToPage(pageNumber);
      }
    },
    [onNavigateToPage],
  );

  const state = {
    messages,
    isStreaming,
  };

  const actions = {
    sendMessage,
    stopStreaming,
    clearMessages,
    handleCitationClick,
  };

  return {
    state,
    actions,
    ...state,
    ...actions,
  };
}

export const useCopilotChat = useCopilot;
export type UseCopilotChatProps = UseCopilotProps;
