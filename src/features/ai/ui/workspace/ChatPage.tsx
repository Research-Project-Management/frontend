'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  ArrowDown,
  CornerDownRight,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { loadCollectionSources } from '../../context/library';
import type { ContextTab } from '../../context/source.port';
import { useActiveAiSpace } from '../../context/space';
import { useTurnContext } from '../../context/use-context';
import { useAiThread } from '../../engine/use-thread';
import { Composer } from '../composer/Composer';
import { ContextPicker } from '../context/ContextPicker';
import { AgentBadge, MessageParts } from '../parts/MessageParts';
import { RewindMenu } from '../parts/RewindMenu';
import { shouldShowAgentBadge } from '../registry/agents';

const WORKSPACE_SUGGESTIONS = [
  {
    id: '1',
    text: 'Create a Sticky with details of all Urgent work items across this project',
  },
  {
    id: '2',
    text: 'Synthesize recent papers from the Project Library and summarize key evidence',
  },
  {
    id: '3',
    text: 'Draft research work items and milestone targets for the current Cycle',
  },
];

function EmptyConversation() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="mb-4 flex items-center justify-center select-none">
        <img
          src="/Chat.svg"
          alt="AI Assistant conversation icon"
          className="size-14 object-contain"
        />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground mb-1.5">
        Start a conversation
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
        Ask about your project, analyze papers, generate LaTeX, or plan your
        next research work items.
      </p>
    </div>
  );
}

export function ChatPage() {
  const { chatId: routeChatId } = useParams<{ chatId?: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || undefined;
  const initialProject = searchParams.get('project') || undefined;
  const collectionId = searchParams.get('collectionId') || undefined;

  const [assignedChatId, setAssignedChatId] = useState<string | null>(null);
  const effectiveChatId = routeChatId ?? assignedChatId;

  useEffect(() => {
    if (pathname === '/ai') {
      setAssignedChatId(null);
    }
  }, [pathname]);

  const { spaceId: workspaceSpaceId } = useActiveAiSpace(initialProject);
  const [pickerTab, setPickerTab] = useState<ContextTab | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const thread = useAiThread({
    threadKey: effectiveChatId || 'draft:workspace',
    chatId: effectiveChatId,
    spaceId: workspaceSpaceId,
    mode: 'chat',
    onChatIdAssigned: (newId) => {
      setAssignedChatId(newId);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/ai/${newId}`);
      }
    },
  });

  const effectiveSpaceId = thread.spaceId ?? workspaceSpaceId;

  const turnCtx = useTurnContext({ spaceId: effectiveSpaceId });

  // Preload collection papers when ?collectionId= is passed
  const preloadedCollectionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!collectionId || preloadedCollectionRef.current === collectionId) {
      return;
    }
    preloadedCollectionRef.current = collectionId;
    loadCollectionSources(collectionId, effectiveSpaceId)
      .then((entries) => {
        if (entries.length > 0) {
          turnCtx.addSources(entries);
          toast.success(`Added ${entries.length} paper(s) to chat sources`);
        }
      })
      .catch(() => {
        toast.error('Failed to load collection for AI chat');
      });
  }, [collectionId, effectiveSpaceId, turnCtx]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (thread.isStreaming) return;
      const trimmed = text.trim();
      if (!trimmed && turnCtx.attachments.length === 0) return;

      const sendOptions = {
        mode: 'chat' as const,
        spaceId: effectiveSpaceId,
        chatId: effectiveChatId,
        documentIds:
          turnCtx.enabledDocumentIds.length > 0
            ? turnCtx.enabledDocumentIds
            : undefined,
        attachedSources:
          turnCtx.attachedSources.length > 0
            ? turnCtx.attachedSources
            : undefined,
        attachments:
          turnCtx.attachments.length > 0 ? turnCtx.attachments : undefined,
        webSearchSites: turnCtx.webSearchEnabled
          ? turnCtx.webSearchSites.length > 0
            ? turnCtx.webSearchSites
            : ['*']
          : undefined,
      };

      turnCtx.clearSources();
      await thread.send(trimmed, sendOptions);
    },
    [thread, turnCtx, effectiveSpaceId, effectiveChatId],
  );

  // Auto-send ?q= on initial entry
  const autoSentQRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialQ && !effectiveChatId && autoSentQRef.current !== initialQ) {
      autoSentQRef.current = initialQ;
      const timer = setTimeout(() => {
        void sendMessage(initialQ);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [initialQ, effectiveChatId, sendMessage]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 200;
    setShowScrollButton((prev) => (prev !== isUp ? isUp : prev));
  }, []);

  const handleScrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || thread.messages.length === 0) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 180;
    if (nearBottom || !thread.isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [thread.messages, thread.isStreaming]);

  const selectedIdSet = useMemo(
    () => new Set(turnCtx.sources.map((s) => s.id)),
    [turnCtx.sources],
  );

  const lastMessage = thread.messages[thread.messages.length - 1];
  const isWaitingFirstChunk =
    thread.isStreaming && (!lastMessage || lastMessage.role === 'user');

  const showWelcome =
    !effectiveChatId &&
    !thread.isStreaming &&
    !thread.isLoadingHistory &&
    thread.messages.length === 0;

  if (showWelcome) {
    return (
      <>
        <div className="h-full flex flex-col items-center justify-center overflow-y-auto px-4 py-8">
          <h1 className="text-24 sm:text-28 font-semibold tracking-tight text-foreground text-center mb-8">
            What can I do for you?
          </h1>

          <div className="w-full max-w-2xl">
            <Composer
              variant="workspace"
              placeholder="How can I help you today?"
              initialValue={initialQ}
              sources={turnCtx.sources}
              uploadingFiles={turnCtx.uploadingFiles}
              isUploading={turnCtx.isUploading}
              onUploadFiles={turnCtx.uploadFiles}
              onRemoveSource={turnCtx.removeSource}
              onToggleSource={turnCtx.toggleSource}
              onOpenPicker={setPickerTab}
              webSearchEnabled={turnCtx.webSearchEnabled}
              webSearchSites={turnCtx.webSearchSites}
              onWebSearchChange={turnCtx.setWebSearchEnabled}
              onWebSearchSitesChange={turnCtx.setWebSearchSites}
              isStreaming={thread.isStreaming}
              onSend={sendMessage}
              onStop={() => void thread.stop()}
              className="max-w-2xl"
            />
          </div>

          <div className="w-full max-w-2xl mt-6">
            <p className="text-11 font-medium text-muted-foreground mb-3 select-none">
              Suggestions
            </p>
            <div className="space-y-0.5">
              {WORKSPACE_SUGGESTIONS.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void sendMessage(item.text)}
                  className={cn(
                    'w-full flex items-start gap-2.5 py-2.5 px-2 -mx-2 rounded-md text-left text-13 leading-5 text-foreground hover:bg-muted transition-colors cursor-pointer',
                    idx !== WORKSPACE_SUGGESTIONS.length - 1 &&
                      'border-b border-border/40',
                  )}
                >
                  <CornerDownRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="leading-snug">{item.text}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-11 text-muted-foreground text-center select-none mt-12">
            AI Assistant can make mistakes, please double-check responses.
          </p>
        </div>

        <ContextPicker
          open={Boolean(pickerTab)}
          onOpenChange={(open) => !open && setPickerTab(null)}
          initialTab={pickerTab ?? 'library'}
          spaceId={effectiveSpaceId}
          selectedIds={selectedIdSet}
          onSelect={(entries) => turnCtx.addSources(entries)}
        />
      </>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {effectiveChatId && thread.messages.length >= 2 && (
        <div className="flex items-center justify-end px-4 sm:px-6 pt-2">
          <RewindMenu
            chatId={effectiveChatId}
            spaceId={effectiveSpaceId}
            disabled={thread.isStreaming}
            onRewound={(msgCount) => thread.trimMessages(msgCount)}
          />
        </div>
      )}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {thread.isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-2 rounded-full bg-ai/40 animate-typing-dot motion-reduce:animate-none"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        ) : thread.messages.length === 0 && !thread.isStreaming ? (
          <EmptyConversation />
        ) : (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {thread.messages.map((msg, i) => {
              const isLast = i === thread.messages.length - 1;
              return (
                <MessageParts
                  key={msg.id || i}
                  message={msg}
                  isStreaming={isLast && thread.isStreaming && msg.role === 'assistant'}
                  onResumeHitl={(decisions) =>
                    void thread.resume(decisions, effectiveSpaceId)
                  }
                />
              );
            })}

            {isWaitingFirstChunk && (
              <div className="space-y-1.5">
                {thread.activeAgent && shouldShowAgentBadge(thread.activeAgent) && (
                  <div>
                    <AgentBadge agent={thread.activeAgent} />
                  </div>
                )}
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-panel/70 border border-border">
                  <Loader2 className="size-3.5 animate-spin text-ai shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Thinking…
                  </span>
                </div>
              </div>
            )}

            {thread.error && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="size-4 shrink-0" />
                  <span className="truncate">
                    {thread.error.message || 'Failed to get AI response.'}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void thread.retry()}
                  className="h-7 px-2.5 gap-1 border-destructive/30 text-destructive hover:bg-destructive/15 shrink-0"
                >
                  <RotateCcw className="size-3" />
                  <span>Retry</span>
                </Button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="shrink-0 bg-background/80 backdrop-blur-sm p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] relative">
        {showScrollButton && (
          <button
            type="button"
            onClick={handleScrollToBottom}
            className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 flex size-9 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="size-4 shrink-0" />
          </button>
        )}

        <Composer
          variant="workspace"
          placeholder="How can I help you today?"
          sources={turnCtx.sources}
          uploadingFiles={turnCtx.uploadingFiles}
          isUploading={turnCtx.isUploading}
          onUploadFiles={turnCtx.uploadFiles}
          onRemoveSource={turnCtx.removeSource}
          onToggleSource={turnCtx.toggleSource}
          onOpenPicker={setPickerTab}
          webSearchEnabled={turnCtx.webSearchEnabled}
          webSearchSites={turnCtx.webSearchSites}
          onWebSearchChange={turnCtx.setWebSearchEnabled}
          onWebSearchSitesChange={turnCtx.setWebSearchSites}
          isStreaming={thread.isStreaming}
          onSend={sendMessage}
          onStop={() => void thread.stop()}
        />
      </div>

      <ContextPicker
        open={Boolean(pickerTab)}
        onOpenChange={(open) => !open && setPickerTab(null)}
        initialTab={pickerTab ?? 'library'}
        spaceId={effectiveSpaceId}
        selectedIds={selectedIdSet}
        onSelect={(entries) => turnCtx.addSources(entries)}
      />
    </div>
  );
}

export default ChatPage;
