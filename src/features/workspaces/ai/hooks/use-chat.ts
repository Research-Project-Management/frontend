'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { ChatMessage, SourceItem, AgentAction } from '../types/chat.types';
import {
  streamChatResponse,
  getChatSession,
  appendChatMessages,
  createChatSession,
} from '../services/chat.service';
import { buildResponseWidgetsFromActions } from '../components/chat/response-widgets';
import { useChatMode } from './use-chat-mode';
import { getCollectionPapers as fetchCollectionPapers } from '@/features/workspaces/library/services/paper.service';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';

export function useChat() {
  const { chatId, workspaceId } = useParams() as { chatId?: string; workspaceId: string };
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || undefined;
  const initialProject = searchParams.get('project') || undefined;
  const router = useRouter();
  const { workspace } = useWorkspace(workspaceId!);
  const {
    enabledDocumentIds,
    fluxDataEnabled,
    setFluxDataEnabled,
    addSource,
    restoreSourceIds,
    clearSources,
  } = useChatMode();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamContent, setStreamContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [activeActions, setActiveActions] = useState<AgentAction[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [sessionProjectId, setSessionProjectId] = useState<string | undefined>(undefined);
  const [sessionTitle, setSessionTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const showScrollButtonRef = useRef(false);
  showScrollButtonRef.current = showScrollButton;

  const streamRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  const activeSourcesRef = useRef<SourceItem[]>([]);
  const activeActionsRef = useRef<AgentAction[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const scrollRafRef = useRef<number | null>(null);
  const preloadedCollectionRef = useRef<string | null>(null);

  const prevChatIdRef = useRef<string | undefined>(undefined);
  const initialScrollDoneRef = useRef<boolean>(false);

  if (prevChatIdRef.current !== chatId) {
    prevChatIdRef.current = chatId;
    initialScrollDoneRef.current = false;
  }

  // Abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Load chat session history or reset
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setStreamContent('');
      setIsStreaming(false);
      setActiveAgent(null);
      setChatStarted(false);
      setSaveError(false);
      setFluxDataEnabled(false);
      setSessionProjectId(undefined);
      setSessionTitle('');
      clearSources();
      abortRef.current?.abort();
      abortRef.current = null;
      streamRef.current = '';
      activeSourcesRef.current = [];
      activeActionsRef.current = [];
      return;
    }

    setIsLoadingHistory(true);
    getChatSession(chatId)
      .then((session) => {
        setSessionTitle(session.title || 'Chat');
        setMessages(
          session.messages.map(({ role, content, sources, widgets }) => ({
            role,
            content,
            sources,
            widgets,
          })),
        );
        if (session.projectId) {
          setSessionProjectId(session.projectId);
        }
        if (session.documentIds?.length > 0) {
          restoreSourceIds(session.documentIds);
          setFluxDataEnabled(true);
        } else {
          setFluxDataEnabled(false);
          clearSources();
        }
      })
      .catch((err) => {
        console.error('Failed to load history:', err);
        toast.error('Failed to load chat history');
      })
      .finally(() => setIsLoadingHistory(false));
  }, [chatId, clearSources, restoreSourceIds, setFluxDataEnabled]);

  // Scroll handler & auto-scroll
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isScrolledUp =
      container.scrollHeight - container.scrollTop - container.clientHeight > 200;
    if (isScrolledUp !== showScrollButtonRef.current) {
      setShowScrollButton(isScrolledUp);
    }
  }, []);

  const handleScrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (messages.length > 0 && !initialScrollDoneRef.current) {
      if (messagesEndRef.current) {
        initialScrollDoneRef.current = true;
        if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          scrollRafRef.current = null;
        });
        return;
      }
    }

    const lastMessage = messages[messages.length - 1];
    const justSent = lastMessage?.role === 'user';

    if (justSent) {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        scrollRafRef.current = null;
      });
      return;
    }

    if (isStreaming) {
      const threshold = 150;
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;

      if (isNearBottom) {
        if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          scrollRafRef.current = null;
        });
      }
    }
  }, [messages, streamContent, isStreaming, chatId, isLoadingHistory]);

  // Preload collection if present
  useEffect(() => {
    const resolvedWorkspaceId = workspace?.id;
    if (!resolvedWorkspaceId) return;

    // Check query params if collection specified
    const collectionId = searchParams.get('collectionId');
    if (!collectionId || preloadedCollectionRef.current === collectionId) return;

    preloadedCollectionRef.current = collectionId;
    fetchCollectionPapers(resolvedWorkspaceId, collectionId)
      .then(({ papers }: { papers: any[] }) => {
        const indexedPapers = papers.filter(
          (paper: any) => paper.ragStatus === 'indexed' && paper.ragDocId,
        );
        indexedPapers.forEach((paper: any) => addSource(paper.ragDocId!, paper.title));

        if (indexedPapers.length > 0) {
          setFluxDataEnabled(true);
          toast.success(`Added ${indexedPapers.length} paper(s) to chat sources`);
        }
      })
      .catch(() => toast.error('Failed to load collection for AI chat'));
  }, [addSource, searchParams, setFluxDataEnabled, workspace?.id]);

  // Send message implementation
  const sendMessage = useCallback(
    async (text: string, projectId?: string, webSearchSites?: string[], intentHint?: string) => {
      if (isStreaming || !text.trim()) return;

      const userMsg: ChatMessage = { role: 'user', content: text.trim() };
      const newMessages = [...messagesRef.current, userMsg];
      setMessages(newMessages);
      streamRef.current = '';
      setStreamContent('');
      setIsStreaming(true);
      setActiveAgent(null);
      setActiveActions([]);
      setChatStarted(true);
      setSaveError(false);
      activeSourcesRef.current = [];
      activeActionsRef.current = [];

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        for await (const chunk of streamChatResponse(newMessages, {
          signal: controller.signal,
          projectId,
          workspaceId,
          chatId: chatId ?? undefined,
          documentIds:
            fluxDataEnabled && enabledDocumentIds.length > 0
              ? enabledDocumentIds
              : undefined,
          webSearchSites,
          intentHint,
          onMeta: (meta) => {
            setActiveAgent(meta.agent);
            if (meta.sources && meta.sources.length > 0) {
              activeSourcesRef.current = meta.sources;
            }
          },
          onAction: (action) => {
            activeActionsRef.current = [...activeActionsRef.current, action];
            setActiveActions(activeActionsRef.current);
          },
        })) {
          streamRef.current += chunk;
          setStreamContent(streamRef.current);
        }

        const finalContent = streamRef.current;
        const hasActions = activeActionsRef.current.length > 0;
        if (!finalContent && !hasActions) return;

        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: finalContent || '',
          sources:
            activeSourcesRef.current.length > 0
              ? [...activeSourcesRef.current]
              : undefined,
          widgets: buildResponseWidgetsFromActions(activeActionsRef.current),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (chatId) {
          try {
            await appendChatMessages(
              chatId,
              [userMsg, assistantMsg],
              fluxDataEnabled && enabledDocumentIds.length > 0
                ? enabledDocumentIds
                : undefined,
            );
          } catch (err) {
            console.error('Failed to save messages:', err);
            setSaveError(true);
          }
        } else if (workspaceId) {
          const title = text.trim().slice(0, 60) || 'New Chat';
          try {
            const session = await createChatSession({
              workspaceId,
              title,
              projectId,
              messages: [userMsg, assistantMsg],
              documentIds:
                fluxDataEnabled && enabledDocumentIds.length > 0
                  ? enabledDocumentIds
                  : undefined,
            });
            setSessionTitle(title);
            router.push(`/${workspaceId}/ai/${session.id}`);
          } catch (err) {
            console.error('Failed to create session:', err);
            setSaveError(true);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Chat error:', error);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: 'Sorry, an error occurred. Please try again.',
            },
          ]);
        }
      } finally {
        setIsStreaming(false);
        setStreamContent('');
        streamRef.current = '';
        abortRef.current = null;
        setActiveAgent(null);
        setActiveActions([]);
        activeActionsRef.current = [];
        activeSourcesRef.current = [];
      }
    },
    [
      isStreaming,
      chatId,
      workspaceId,
      router,
      enabledDocumentIds,
      fluxDataEnabled,
    ],
  );

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSendRef = useRef(sendMessage);
  handleSendRef.current = sendMessage;

  // Auto-send when ?q= is present
  useEffect(() => {
    if (initialQ && !chatId) {
      const timer = setTimeout(() => {
        handleSendRef.current(initialQ, initialProject, undefined, undefined);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [chatId, initialProject, initialQ]);

  return {
    chatId,
    workspaceId,
    workspace,
    initialQ,
    initialProject,
    messages,
    streamContent,
    isStreaming,
    isLoadingHistory,
    activeAgent,
    activeActions,
    showScrollButton,
    chatStarted,
    saveError,
    sessionProjectId,
    sessionTitle,
    messagesEndRef,
    scrollContainerRef,
    sendMessage,
    stopStream,
    handleScroll,
    handleScrollToBottom,
  };
}

// Backward compatibility alias
export const useWorkspaceChat = useChat;
