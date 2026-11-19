'use client';

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getPageChat, getSession } from '../transport/sessions';
import type { TurnContext, TurnMode } from '../types/context';
import type { HitlDecision } from '../types/message';
import type { ThreadEngine, ThreadEngineCallbacks } from './engine.port';
import { mapStoredMessagesToFlux } from './history';
import { threadPool } from './pool';
import { invalidateAiSessions } from './queries';

export interface UseAiThreadOptions {
  threadKey: string;
  chatId?: string | null;
  pageId?: string | null;
  spaceId?: string | null;
  mode?: TurnMode;
  onChatIdAssigned?: (chatId: string, title?: string) => void;
  onSessionNotFound?: () => void;
}

export function useAiThread({
  threadKey,
  chatId = null,
  pageId = null,
  spaceId = null,
  mode = 'chat',
  onChatIdAssigned,
  onSessionNotFound,
}: UseAiThreadOptions) {
  const queryClient = useContext(QueryClientContext);

  const latestRef = useRef({
    threadKey,
    spaceId,
    queryClient,
    onChatIdAssigned,
    onSessionNotFound,
  });
  useEffect(() => {
    latestRef.current = {
      threadKey,
      spaceId,
      queryClient,
      onChatIdAssigned,
      onSessionNotFound,
    };
  });

  const engineCallbacks = useMemo<ThreadEngineCallbacks>(
    () => ({
      onChatCreated: (newChatId, title) => {
        const {
          threadKey: currentKey,
          spaceId: currentSpaceId,
          queryClient: qc,
          onChatIdAssigned: onAssigned,
        } = latestRef.current;
        threadPool.rebind(currentKey, newChatId);
        if (qc) {
          invalidateAiSessions(qc, currentSpaceId);
        }
        onAssigned?.(newChatId, title);
      },
      onTurnSettled: (_settledChatId, settledSpaceId) => {
        const { spaceId: currentSpaceId, queryClient: qc } = latestRef.current;
        if (qc) {
          invalidateAiSessions(qc, settledSpaceId ?? currentSpaceId);
        }
      },
    }),
    [],
  );

  const engine = threadPool.getOrCreate(threadKey, {
    chatId,
    pageId,
    spaceId,
    mode,
    callbacks: engineCallbacks,
  });

  const prevEngineRef = useRef<ThreadEngine | null>(null);
  useEffect(() => {
    const snap = engine.getSnapshot();
    const isWarmSwitch =
      prevEngineRef.current !== engine &&
      snap.messages.length > 0 &&
      Boolean(snap.spaceId);
    prevEngineRef.current = engine;

    engine.setMeta({
      chatId,
      pageId,
      mode,
      callbacks: engineCallbacks,
      ...(isWarmSwitch ? {} : { spaceId }),
    });
  }, [engine, chatId, pageId, spaceId, mode, engineCallbacks]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => engine.subscribe(onStoreChange),
    [engine],
  );
  const getSnapshot = useCallback(() => engine.getSnapshot(), [engine]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Hydrate persisted history ONLY when opening an existing chat/page whose engine
  // does not already hold fresh messages in memory (eliminates post-stream flash).
  const hydratedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const snap = engine.getSnapshot();
    const targetKey = chatId
      ? `chat:${chatId}`
      : pageId
        ? `page:${pageId}`
        : null;

    if (!targetKey) {
      hydratedKeyRef.current = null;
      return;
    }

    if (hydratedKeyRef.current === targetKey) {
      return;
    }

    if (
      snap.messages.length > 0 &&
      ((chatId && snap.chatId === chatId) || (pageId && snap.pageId === pageId))
    ) {
      hydratedKeyRef.current = targetKey;
      return;
    }

    if (snap.isStreaming) {
      return;
    }

    let cancelled = false;
    hydratedKeyRef.current = targetKey;
    engine.setLoadingHistory(true);

    if (chatId) {
      getSession(chatId)
        .then((session) => {
          if (cancelled) return;
          engine.hydrateMessages(
            mapStoredMessagesToFlux(session.messages || []),
            {
              chatId: session.id || chatId,
              title: session.title || 'Chat',
              spaceId: session.spaceId ?? session.projectId ?? spaceId,
              documentIds: session.documentIds ?? [],
            },
          );
        })
        .catch(() => {
          if (cancelled) return;
          engine.setLoadingHistory(false);
          if (latestRef.current.onSessionNotFound) {
            latestRef.current.onSessionNotFound();
          } else {
            toast.error('Failed to load chat history');
          }
        });
    } else if (pageId) {
      getPageChat(pageId)
        .then((res) => {
          if (cancelled) return;
          engine.hydrateMessages(
            mapStoredMessagesToFlux(res.messages || []),
            {
              chatId: res.chatId,
              spaceId,
            },
          );
        })
        .catch(() => {
          if (cancelled) return;
          engine.setLoadingHistory(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [engine, chatId, pageId, spaceId]);

  const send = useCallback(
    async (text: string, context?: TurnContext) => {
      await engine.send(text, context);
    },
    [engine],
  );

  const resume = useCallback(
    async (decision: HitlDecision | HitlDecision[], overrideSpaceId?: string | null) => {
      await engine.resume(decision, overrideSpaceId);
    },
    [engine],
  );

  const stop = useCallback(async () => {
    await engine.stop();
  }, [engine]);

  const retry = useCallback(async () => {
    await engine.retry();
  }, [engine]);

  const reset = useCallback(
    (options?: { keepMeta?: boolean }) => {
      hydratedKeyRef.current = null;
      engine.reset(options);
    },
    [engine],
  );

  return {
    ...snapshot,
    send,
    resume,
    stop,
    retry,
    reset,
  };
}
