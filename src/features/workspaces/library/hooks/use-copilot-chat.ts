'use client';

import { useState, useRef, useCallback } from 'react';
import { streamPaperCopilotChat } from '../services/copilot.service';
import type { CopilotMessage, CopilotCitation } from '../types/copilot.types';

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
      setInput('');
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const stream = streamPaperCopilotChat(
          paperId,
          newHistory.map((m) => ({ role: m.role, content: m.content })),
          {
            selection: selectionContext,
            signal: controller.signal,
            onCitation: (citations: CopilotCitation[]) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, citations: [...(msg.citations || []), ...citations] }
                    : msg,
                ),
              );
            },
          },
        );

        let accumulated = '';
        for await (const chunk of stream) {
          accumulated += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulated }
                : msg,
            ),
          );
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content:
                      msg.content ||
                      `⚠️ Error streaming AI response: ${err.message || 'Network error'}`,
                  }
                : msg,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false }
              : msg,
          ),
        );
        abortControllerRef.current = null;
      }
    },
    [input, isStreaming, messages, paperId],
  );

  const askSelection = useCallback(
    async (selectedText: string, pageNumber: number) => {
      const prompt = `Please explain this excerpt from Page ${pageNumber}:\n\n> "${selectedText}"`;
      await sendMessage(prompt, { text: selectedText, pageNumber });
    },
    [sendMessage],
  );

  const handleCitationClick = useCallback(
    (pageNumber: number) => {
      if (onNavigateToPage) {
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
    askSelection,
    stopStreaming,
    clearMessages,
    handleCitationClick,
  };
}
