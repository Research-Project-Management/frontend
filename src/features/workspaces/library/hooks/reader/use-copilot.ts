'use client';

import { useState, useRef, useCallback } from 'react';
import { streamPaperCopilotChat } from '../../services/copilot.service';
import type { CopilotMessage, CopilotCitation } from '../../types/copilot.types';

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
      setInput('');
      setIsStreaming(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const historyForBackend = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let accumulatedText = '';
        let citationsCaptured: CopilotCitation[] = [];

        const stream = streamPaperCopilotChat(
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

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false, citations: citationsCaptured.length > 0 ? citationsCaptured : msg.citations }
              : msg,
          ),
        );
      } catch (err: any) {
        if (err.name !== 'AbortError') {
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

  const state = {
    messages,
    input,
    isStreaming,
  };

  const actions = {
    setInput,
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
