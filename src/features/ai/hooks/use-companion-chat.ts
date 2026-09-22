'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import type { ChatMessage, SourceItem, AgentAction } from '../types/chat.types';
import {
  streamChatResponse,
  getChatSession,
  createChatSession,
} from '../services/chat.service';
import { buildResponseWidgetsFromActions } from '../components/chat/response-widgets';
import { useAiCompanionStore } from '../store/ai-companion.store';

export interface CompanionSendOptions {
  projectId?: string | null;
  webSearchSites?: string[] | null;
  documentIds?: string[] | null;
  attachedFiles?: Array<{ id: string; name: string; size?: number }>;
}

export function useCompanionChat() {
  const pathname = usePathname();
  const {
    activeChatId,
    setActiveChatId,
    selectedModel,
  } = useAiCompanionStore();

  // Extract current project ID from URL if inside a project
  const currentProjectId = useMemo(() => {
    const match = pathname?.match(/\/projects\/([^/]+)/);
    return match ? match[1] : undefined;
  }, [pathname]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamContent, setStreamContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [activeActions, setActiveActions] = useState<AgentAction[]>([]);
  const [sessionTitle, setSessionTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef('');
  const activeSourcesRef = useRef<SourceItem[]>([]);
  const activeActionsRef = useRef<AgentAction[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Load chat session history when activeChatId changes
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      setStreamContent('');
      setIsStreaming(false);
      setActiveAgent(null);
      setSessionTitle('');
      abortRef.current?.abort();
      abortRef.current = null;
      streamRef.current = '';
      activeSourcesRef.current = [];
      activeActionsRef.current = [];
      return;
    }

    setIsLoadingHistory(true);
    getChatSession(activeChatId)
      .then((session) => {
        setSessionTitle(session.title || 'Chat');
        setMessages(
          (session.messages || []).map(({ role, content, sources, widgets }) => ({
            role,
            content,
            sources,
            widgets,
          }))
        );
      })
      .catch((err) => {
        console.error('[CompanionChat] Failed to load history:', err);
        // If session not found, reset
        setActiveChatId(null);
      })
      .finally(() => setIsLoadingHistory(false));
  }, [activeChatId, setActiveChatId]);

  // Auto-scroll when messages change or streaming
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamContent]);

  // Send message
  const sendMessage = useCallback(
    async (text: string, options?: CompanionSendOptions) => {
      const trimmed = text.trim();
      if (
        isStreaming ||
        (!trimmed && (!options?.attachedFiles || options.attachedFiles.length === 0))
      )
        return;

      const userMsg: ChatMessage = {
        role: 'user',
        content:
          trimmed ||
          (options?.attachedFiles?.length
            ? `[Attached ${options.attachedFiles.length} file(s)]`
            : ''),
        sources: options?.attachedFiles?.map((f) => ({
          id: f.id,
          title: f.name,
          sourceType: 'upload',
        })),
      };
      const newMessages = [...messagesRef.current, userMsg];
      setMessages(newMessages);
      streamRef.current = '';
      setStreamContent('');
      setIsStreaming(true);
      setActiveAgent(null);
      setActiveActions([]);
      activeSourcesRef.current = [];
      activeActionsRef.current = [];

      const controller = new AbortController();
      abortRef.current = controller;
      let serverCreatedChatId: string | null = null;

      const effectiveProjectId =
        options?.projectId !== undefined ? options.projectId : currentProjectId;

      try {
        for await (const chunk of streamChatResponse(newMessages, {
          signal: controller.signal,
          projectId: effectiveProjectId,
          documentIds: options?.documentIds,
          webSearchSites: options?.webSearchSites,
          chatId: activeChatId ?? undefined,
          onMeta: (meta) => {
            if (meta.agent) setActiveAgent(meta.agent ?? null);
            if (meta.sources && meta.sources.length > 0) {
              activeSourcesRef.current = meta.sources;
            }
            if (meta.chatId && !activeChatId) {
              serverCreatedChatId = meta.chatId;
              if (meta.title) setSessionTitle(meta.title);
            }
          },
          onAction: (action) => {
            activeActionsRef.current = [...activeActionsRef.current, action];
            setActiveActions([...activeActionsRef.current]);
          },
        })) {
          streamRef.current += chunk;
          setStreamContent(streamRef.current);
        }

        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: streamRef.current,
          sources:
            activeSourcesRef.current.length > 0 ? activeSourcesRef.current : undefined,
          widgets: buildResponseWidgetsFromActions(activeActionsRef.current),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setStreamContent('');

        // If a new session was created on the server, set it as active
        if (serverCreatedChatId) {
          setActiveChatId(serverCreatedChatId);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('[CompanionChat] Stream error:', err);
        toast.error('Failed to get AI response');
        // Revert user message on complete failure
        setMessages((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [activeChatId, currentProjectId, isStreaming, setActiveChatId]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    if (streamRef.current) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: streamRef.current,
          sources: activeSourcesRef.current.length > 0 ? activeSourcesRef.current : undefined,
        },
      ]);
      setStreamContent('');
    }
  }, []);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveChatId(null);
    setMessages([]);
    setStreamContent('');
    setIsStreaming(false);
    setSessionTitle('');
  }, [setActiveChatId]);

  return {
    messages,
    streamContent,
    isStreaming,
    isLoadingHistory,
    activeAgent,
    activeActions,
    sessionTitle,
    currentProjectId,
    selectedModel,
    messagesEndRef,
    scrollContainerRef,
    sendMessage,
    stopStreaming,
    startNewChat,
  };
}
