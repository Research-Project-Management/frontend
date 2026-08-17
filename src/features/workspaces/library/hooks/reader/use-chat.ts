'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { ChatMessage, SourceItem, ChatSession, ChatSessionDetail } from '../../types/ai.types';
import {
  streamChatResponse,
  getChatSession,
  appendChatMessages,
  createChatSession,
  listChatSessions,
  deleteChatSession,
} from '../../services/ai.service';

interface UseChatOptions {
  workspaceId: string;
  ragDocId: string;
  paperTitle: string;
  selectionContext: string;
  onClearSelectionContext: () => void;
}

interface UseChatReturn {
  chatId: string | null;
  messages: ChatMessage[];
  inputMessage: string;
  isStreaming: boolean;
  streamContent: string;
  isLoadingHistory: boolean;
  setInputMessage: (v: string) => void;
  handleSend: (text: string) => Promise<void>;
  handleStop: () => void;
  handleClearChat: () => Promise<void>;
}

/**
 * Manages chat session lifecycle: load history, stream messages,
 * persist to backend, and clear conversations.
 */
export function useChat({
  workspaceId,
  ragDocId,
  paperTitle,
  selectionContext,
  onClearSelectionContext,
}: UseChatOptions): UseChatReturn {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const streamRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  const activeSourcesRef = useRef<SourceItem[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // ── Load existing chat session ──────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId || !ragDocId) return;

    setIsLoadingHistory(true);
    listChatSessions(workspaceId)
      .then((res) => {
        if (res.success && res.data) {
          const matching = res.data.find(
            (s: ChatSession) => s.documentIds?.length === 1 && s.documentIds[0] === ragDocId,
          );
          if (matching) {
            setChatId(matching._id);
            return getChatSession(matching._id).then((detailRes) => {
              if (detailRes.success && detailRes.data) {
                const historyMsgs = detailRes.data.messages ?? [];
                setMessages(
                  historyMsgs.map(({ role, content, sources, widgets }: ChatMessage) => ({
                    role,
                    content,
                    sources,
                    widgets,
                  })),
                );
              }
            });
          }
        }
        setChatId(null);
        setMessages([]);
      })
      .catch((err: unknown) => console.error('Failed to restore reader chat:', err))
      .finally(() => setIsLoadingHistory(false));

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [workspaceId, ragDocId]);

  // ── Send Message ────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text: string) => {
      const userText = text.trim();
      if (!userText || isStreaming || !workspaceId || !ragDocId) return;

      const hasSelectedText = !!selectionContext;
      const selectedText = selectionContext;

      const userMsg: ChatMessage = {
        role: 'user',
        content: userText,
      };

      const nextMessages = [...messagesRef.current, userMsg];
      setMessages(nextMessages);
      setInputMessage('');
      setIsStreaming(true);
      setStreamContent('');
      streamRef.current = '';
      activeSourcesRef.current = [];

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        for await (const chunk of streamChatResponse(nextMessages, {
          projectId: undefined,
          workspaceId,
          chatId: chatId ?? undefined,
          documentIds: [ragDocId],
          intentHint: 'rag',
          selection: hasSelectedText ? selectedText : undefined,
          cursorContext: hasSelectedText
            ? 'The user selected this passage in the reader. Use it as the focus, but answer from the indexed paper context.'
            : undefined,
          signal: abortController.signal,
          onMeta: (meta: { agent: string; intent: string; sources?: SourceItem[] }) => {
            if (meta.sources?.length) {
              activeSourcesRef.current = meta.sources;
            }
          },
        })) {
          streamRef.current += chunk;
          setStreamContent(streamRef.current);
        }

        if (hasSelectedText) {
          onClearSelectionContext();
        }

        const finalContent = streamRef.current;
        if (!finalContent) return;

        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: finalContent,
          sources: activeSourcesRef.current.length > 0 ? [...activeSourcesRef.current] : undefined,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Persist to backend
        try {
          if (chatId) {
            await appendChatMessages(chatId, [userMsg, assistantMsg], [ragDocId]);
          } else {
            const title = `Paper: ${paperTitle.slice(0, 40)}`;
            const session = await createChatSession({
              workspaceId,
              title,
              messages: [userMsg, assistantMsg],
              documentIds: [ragDocId],
            });
            if (session.success) {
              setChatId(session.data._id);
            }
          }
        } catch (saveErr) {
          console.warn('Failed to persist chat:', saveErr);
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Chat stream error:', error);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: 'An error occurred while processing your request. Please try again.',
            },
          ]);
        }
      } finally {
        setIsStreaming(false);
        setStreamContent('');
        streamRef.current = '';
        abortRef.current = null;
        activeSourcesRef.current = [];
      }
    },
    [isStreaming, workspaceId, ragDocId, chatId, selectionContext, paperTitle, onClearSelectionContext],
  );

  // ── Stop streaming ──────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── Clear chat ──────────────────────────────────────────────────────────
  const handleClearChat = useCallback(async () => {
    const activeChatId = chatId;
    setMessages([]);
    setChatId(null);
    setStreamContent('');
    streamRef.current = '';

    if (activeChatId) {
      try {
        await deleteChatSession(activeChatId);
        toast.success('Conversation cleared');
      } catch (err) {
        console.error('Failed to delete chat session:', err);
        toast.error('Could not clear conversation from server');
      }
    }
  }, [chatId]);

  // ── Listen to parent clear event ────────────────────────────────────────
  useEffect(() => {
    const handler = () => handleClearChat();
    window.addEventListener('clear-reader-chat', handler);
    return () => window.removeEventListener('clear-reader-chat', handler);
  }, [handleClearChat]);

  return {
    chatId,
    messages,
    inputMessage,
    isStreaming,
    streamContent,
    isLoadingHistory,
    setInputMessage,
    handleSend,
    handleStop,
    handleClearChat,
  };
}
