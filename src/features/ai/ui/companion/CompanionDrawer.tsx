'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ChevronRight,
  History,
  Maximize2,
  SquarePen,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useReaderStore } from '@/features/library/core/store/reader.store';
import { useActiveAiSpace } from '../../context/space';
import {
  getRagDocumentId,
  sourceEntryToAttachedPayload,
  type ContextTab,
  type SourceEntry,
} from '../../context/source.port';
import { useTurnContext } from '../../context/use-context';
import { threadPool } from '../../engine/pool';
import { useAiCompanionStore } from '../../engine/shell';
import { useAiThread } from '../../engine/use-thread';
import { Composer, type ReaderDocScope } from '../composer/Composer';
import { ContextPicker } from '../context/ContextPicker';
import { CompanionHistory } from './CompanionHistory';
import { CompanionMessages } from './CompanionMessages';

const MIN_DRAWER_WIDTH = 280;
const MAX_DRAWER_WIDTH = 840;
const DEFAULT_DRAWER_WIDTH = 380;

function getResponsiveMaxWidth(): number {
  if (typeof window === 'undefined') return MAX_DRAWER_WIDTH;
  return Math.max(420, Math.min(MAX_DRAWER_WIDTH, Math.floor(window.innerWidth * 0.55)));
}

function CompanionDrawerInner() {
  const pathname = usePathname();
  const isPaperReader = Boolean(pathname?.includes('/library/papers/'));

  const readerTabs = useReaderStore((s) => s.tabs);
  const readerActiveTabId = useReaderStore((s) => s.activeTabId);

  const openReaderPapers = useMemo(
    () =>
      readerTabs
        .filter((t) => t.type === 'paper' && t.id && t.id !== 'library')
        .map((t) => ({ id: t.id, title: t.title || 'Untitled Document' })),
    [readerTabs],
  );

  const readerPaper = useMemo(() => {
    const active = openReaderPapers.find((p) => p.id === readerActiveTabId);
    return active ?? openReaderPapers[0] ?? null;
  }, [openReaderPapers, readerActiveTabId]);

  const {
    setOpen,
    width,
    setWidth,
    isHistoryView,
    toggleHistoryView,
    setHistoryView,
    activeChatId,
    setActiveChatId,
    pendingPrompt,
    setPendingPrompt,
    quotedPassage,
    setQuotedPassage,
  } = useAiCompanionStore();

  const { spaceId: activeSpaceId } = useActiveAiSpace();
  const [readerDocScope, setReaderDocScope] =
    useState<ReaderDocScope>('current');
  const [pickerTab, setPickerTab] = useState<ContextTab | null>(null);
  const [promptToFill, setPromptToFill] = useState('');

  useEffect(() => {
    setReaderDocScope('current');
  }, [readerPaper?.id]);

  const threadKey = activeChatId || 'draft:companion';
  const thread = useAiThread({
    threadKey,
    chatId: activeChatId,
    spaceId: activeSpaceId,
    mode: 'chat',
    onChatIdAssigned: (newChatId) => {
      setActiveChatId(newChatId);
    },
    onSessionNotFound: () => {
      setActiveChatId(null);
    },
  });

  const turnCtx = useTurnContext({ spaceId: activeSpaceId });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thread.messages, thread.isStreaming]);

  const handleSend = useCallback(
    async (
      rawText: string,
      overrides?: {
        spaceId?: string | null;
        webSearchSites?: string[] | null;
        documentIds?: string[] | null;
        attachedFiles?: Array<{ id: string; name: string; size?: number }>;
      },
    ) => {
      if (thread.isStreaming) return;

      const effectiveSpaceId =
        overrides?.spaceId !== undefined ? overrides.spaceId : activeSpaceId;

      const extraSources: SourceEntry[] = [];
      if (overrides?.attachedFiles?.length) {
        for (const f of overrides.attachedFiles) {
          extraSources.push({
            id: f.id,
            name: f.name,
            size: f.size,
            enabled: true,
            sourceType: 'upload',
          });
        }
      } else {
        for (const s of turnCtx.sources) {
          if (s.enabled) extraSources.push(s);
        }
      }

      if (isPaperReader) {
        if (
          readerDocScope === 'current' &&
          readerPaper?.id &&
          !extraSources.some((f) => f.id === readerPaper.id)
        ) {
          extraSources.unshift({
            id: readerPaper.id,
            name: readerPaper.title || 'Current Paper',
            enabled: true,
            sourceType: 'paper',
          });
        } else if (readerDocScope === 'open-tabs') {
          const tabsToAdd =
            openReaderPapers.length > 0
              ? openReaderPapers
              : readerPaper
                ? [readerPaper]
                : [];
          for (const tab of [...tabsToAdd].reverse()) {
            if (!extraSources.some((f) => f.id === tab.id)) {
              extraSources.unshift({
                id: tab.id,
                name: tab.title || 'Open Paper',
                enabled: true,
                sourceType: 'paper',
              });
            }
          }
        }
      } else if (
        quotedPassage?.paperId &&
        !extraSources.some((f) => f.id === quotedPassage.paperId)
      ) {
        extraSources.unshift({
          id: quotedPassage.paperId,
          name: quotedPassage.paperTitle || 'Quoted Paper',
          enabled: true,
          sourceType: 'paper',
        });
      }

      const combinedDocIds = Array.from(
        new Set([
          ...(overrides?.documentIds ?? []),
          ...extraSources
            .map(getRagDocumentId)
            .filter((id): id is string => Boolean(id)),
        ]),
      ).filter(Boolean);

      const attachedSources = extraSources.map(sourceEntryToAttachedPayload);

      let finalMessageText = rawText.trim();
      if (quotedPassage?.text && !overrides) {
        const pageBadge = quotedPassage.pageNumber
          ? ` (p. ${quotedPassage.pageNumber})`
          : '';
        const quoteBlock = `> "${quotedPassage.text.trim()}"${pageBadge}`;
        finalMessageText = finalMessageText
          ? `${quoteBlock}\n\n${finalMessageText}`
          : `${quoteBlock}\n\nExplain this passage, its methodology or context, and why it is important in the paper.`;
      }

      if (!finalMessageText && extraSources.length === 0) return;

      const usePaperEndpoint =
        isPaperReader && readerDocScope === 'current' && Boolean(readerPaper?.id);

      const webSites =
        overrides?.webSearchSites !== undefined
          ? overrides.webSearchSites
          : turnCtx.webSearchEnabled
            ? turnCtx.webSearchSites.length > 0
              ? turnCtx.webSearchSites
              : ['*']
            : undefined;

      if (!overrides) {
        setQuotedPassage(null);
        setPromptToFill('');
      }

      const sendOptions = {
        mode: (usePaperEndpoint ? 'paper' : 'chat') as 'paper' | 'chat',
        spaceId: effectiveSpaceId,
        chatId: activeChatId,
        documentIds: combinedDocIds.length > 0 ? combinedDocIds : undefined,
        attachedSources:
          attachedSources.length > 0 ? attachedSources : undefined,
        attachments: extraSources.map((s) => ({
          id: s.id,
          name: s.name,
          size: s.size,
          sourceType: s.sourceType,
          ...(s.itemId ? { itemId: s.itemId } : {}),
          ...(s.fileId ? { fileId: s.fileId } : {}),
          ...(s.hasPdf !== undefined ? { hasPdf: s.hasPdf } : {}),
          ...(s.indexed !== undefined ? { indexed: s.indexed } : {}),
        })),
        webSearchSites: webSites ?? undefined,
        paper:
          usePaperEndpoint && readerPaper
            ? {
                paperId: readerPaper.id,
                paperTitle: readerPaper.title,
                quotedPassage: quotedPassage?.text,
                pageNumber: quotedPassage?.pageNumber,
              }
            : quotedPassage?.paperId
              ? {
                  paperId: quotedPassage.paperId,
                  paperTitle: quotedPassage.paperTitle,
                  quotedPassage: quotedPassage.text,
                  pageNumber: quotedPassage.pageNumber,
                }
              : undefined,
      };

      if (!overrides) {
        turnCtx.clearSources();
      }
      await thread.send(finalMessageText, sendOptions);
    },
    [
      thread,
      activeSpaceId,
      turnCtx,
      isPaperReader,
      readerDocScope,
      readerPaper,
      openReaderPapers,
      quotedPassage,
      setQuotedPassage,
      activeChatId,
    ],
  );

  // Consume external handoff prompts (Home ChatAi, Library Reader Ask AI)
  useEffect(() => {
    if (pendingPrompt && pendingPrompt.text && !thread.isStreaming) {
      const prompt = { ...pendingPrompt };
      setPendingPrompt(null);
      void handleSend(prompt.text, {
        spaceId: prompt.spaceId ?? prompt.projectId,
        documentIds: prompt.documentIds,
        attachedFiles: prompt.attachedFiles,
        webSearchSites:
          prompt.webSearchSites || (prompt.webSearch ? ['*'] : undefined),
      });
    }
  }, [pendingPrompt, thread.isStreaming, setPendingPrompt, handleSend]);

  const startNewChat = useCallback(() => {
    threadPool.get('draft:companion')?.reset();
    setActiveChatId(null);
    setHistoryView(false);
    setPromptToFill('');
  }, [setActiveChatId, setHistoryView]);

  // ── Resize Drag State ──────────────────────────────────────────────────────
  const [isResizing, setIsResizing] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [maxWidth, setMaxWidth] = useState(MAX_DRAWER_WIDTH);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);
  const latestClientXRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const syncViewport = () => {
      setIsMobile(window.innerWidth < 768);
      setMaxWidth(getResponsiveMaxWidth());
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      latestClientXRef.current = e.clientX;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    },
    [width],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      latestClientXRef.current = e.clientX;
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          const delta = startXRef.current - latestClientXRef.current;
          const rawWidth = startWidthRef.current + delta;
          setLiveWidth(Math.min(Math.max(rawWidth, 240), getResponsiveMaxWidth()));
        });
      }
    };

    const handleMouseUp = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      const delta = startXRef.current - latestClientXRef.current;
      const rawWidth = startWidthRef.current + delta;
      if (rawWidth < 200) {
        setOpen(false);
        setLiveWidth(null);
        setWidth(DEFAULT_DRAWER_WIDTH);
      } else {
        setWidth(Math.min(Math.max(rawWidth, MIN_DRAWER_WIDTH), getResponsiveMaxWidth()));
        setLiveWidth(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { capture: true });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      window.removeEventListener('mousemove', handleMouseMove, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
    };
  }, [isResizing, setOpen, setWidth]);

  const currentWidth = Math.min(liveWidth ?? width, maxWidth);

  const selectedIdSet = useMemo(
    () => new Set(turnCtx.sources.map((s) => s.id)),
    [turnCtx.sources],
  );

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden animate-in fade-in duration-150 motion-reduce:animate-none"
        aria-hidden="true"
      />

      {isResizing && (
        <div
          className="fixed inset-0 z-50 cursor-col-resize select-none pointer-events-auto"
          style={{ userSelect: 'none', cursor: 'col-resize' }}
        />
      )}

      <aside
        style={isMobile ? undefined : { width: `${currentWidth}px` }}
        aria-label="AI Assistant Companion Sidebar"
        className={cn(
          'flex flex-col bg-background relative pb-[env(safe-area-inset-bottom)]',
          'fixed inset-y-0 right-0 z-50 w-full sm:max-w-md shadow-lg border-l border-border animate-in slide-in-from-right duration-200 motion-reduce:animate-none motion-reduce:transform-none overflow-hidden',
          isPaperReader
            ? 'md:relative md:inset-auto md:z-auto md:order-3 md:h-full md:max-w-none md:shrink-0 md:rounded-none md:border-y-0 md:border-r-0 md:border-l md:border-border md:shadow-none md:animate-none md:overflow-visible'
            : 'md:relative md:inset-auto md:z-auto md:order-3 md:h-auto md:self-stretch md:max-w-none md:shrink-0 md:rounded-md md:border md:border-border md:mr-2 md:mb-2 md:shadow-none md:animate-none md:overflow-visible',
          isResizing && 'transition-none select-none',
        )}
      >
        {/* Resizer handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={currentWidth}
          aria-valuemin={MIN_DRAWER_WIDTH}
          aria-valuemax={maxWidth}
          aria-label="Drag to resize, double-click to reset (380px)"
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onDoubleClick={() => {
            setWidth(DEFAULT_DRAWER_WIDTH);
            setLiveWidth(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setWidth(Math.min(maxWidth, width + 20));
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              setWidth(Math.max(MIN_DRAWER_WIDTH, width - 20));
            } else if (e.key === 'Home') {
              e.preventDefault();
              setWidth(MIN_DRAWER_WIDTH);
            } else if (e.key === 'End') {
              e.preventDefault();
              setWidth(maxWidth);
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setWidth(DEFAULT_DRAWER_WIDTH);
            }
          }}
          className={cn(
            'hidden md:flex absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize items-center justify-center z-30 select-none group focus-visible:outline-none',
            isResizing && 'pointer-events-auto',
          )}
        >
          <div
            className={cn(
              'w-0.5 h-full transition-colors duration-150 bg-transparent group-hover:bg-ai/60',
              isResizing && 'bg-ai',
            )}
          />
        </div>

        <div className="flex flex-col h-full w-full min-h-0 overflow-hidden rounded-[inherit]">
          {isHistoryView ? (
            <header
              className={cn(
                'flex items-center justify-between px-2.5 sm:px-3 border-b border-border bg-transparent shrink-0 select-none',
                isPaperReader ? 'h-10 text-12' : 'h-11 text-13',
              )}
            >
              <span
                className={cn(
                  'font-semibold text-foreground tracking-tight',
                  isPaperReader ? 'text-12' : 'text-13',
                )}
              >
                Chat history
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setHistoryView(false)}
                    className="relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
                    aria-label="Back to chat"
                  >
                    <ChevronRight className="size-4 shrink-0 text-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  Back to chat
                </TooltipContent>
              </Tooltip>
            </header>
          ) : (
            <header
              className={cn(
                'flex items-center justify-between px-2.5 sm:px-3 border-b border-border bg-transparent shrink-0 select-none',
                isPaperReader ? 'h-10 text-12' : 'h-11 text-13',
              )}
            >
              <div className="flex items-center min-w-0 flex-1 mr-2">
                <span
                  className={cn(
                    'font-semibold text-foreground tracking-tight truncate',
                    isPaperReader ? 'text-12' : 'text-13',
                  )}
                  title="AI Assistant"
                >
                  AI Assistant
                </span>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={startNewChat}
                      className="relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
                      aria-label="New chat"
                    >
                      <SquarePen className="size-3.5 shrink-0 text-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    New chat
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleHistoryView}
                      className="relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
                      aria-label="Chat history"
                    >
                      <History className="size-3.5 shrink-0 text-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    Chat history
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={activeChatId ? `/ai/${activeChatId}` : '/ai'}
                      onClick={() => setOpen(false)}
                      className="relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
                      aria-label="Full screen"
                    >
                      <Maximize2 className="size-3.5 shrink-0 text-foreground" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    Full screen
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
                      aria-label="Collapse (Ctrl+J)"
                    >
                      <X className="size-3.5 shrink-0 text-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    Collapse (Ctrl+J)
                  </TooltipContent>
                </Tooltip>
              </div>
            </header>
          )}

          {isHistoryView ? (
            <CompanionHistory
              currentSpaceId={activeSpaceId}
              onNewChat={startNewChat}
            />
          ) : (
            <>
              <CompanionMessages
                messages={thread.messages}
                isStreaming={thread.isStreaming}
                isLoadingHistory={thread.isLoadingHistory}
                activeAgent={thread.activeAgent}
                error={thread.error}
                messagesEndRef={messagesEndRef}
                scrollContainerRef={scrollContainerRef}
                onSelectPrompt={setPromptToFill}
                onResumeHitl={(decisions) =>
                  void thread.resume(decisions, activeSpaceId)
                }
                onRetry={() => void thread.retry()}
                isReaderContext={isPaperReader}
              />

              <Composer
                variant="companion"
                className={
                  isPaperReader
                    ? 'px-3 pb-2.5 pt-1.5 bg-background'
                    : 'px-3.5 pb-3 pt-2 bg-background'
                }
                placeholder={
                  isPaperReader
                    ? 'Ask about this paper, methods, or findings...'
                    : 'How can I help you today?'
                }
                showDisclaimer
                initialValue={promptToFill}
                sources={turnCtx.sources}
                uploadingFiles={turnCtx.uploadingFiles}
                isUploading={turnCtx.isUploading}
                onUploadFiles={turnCtx.uploadFiles}
                onRemoveSource={turnCtx.removeSource}
                onOpenPicker={setPickerTab}
                webSearchEnabled={turnCtx.webSearchEnabled}
                onWebSearchChange={turnCtx.setWebSearchEnabled}
                isReaderContext={isPaperReader}
                readerPaper={isPaperReader ? readerPaper : null}
                openReaderPapers={isPaperReader ? openReaderPapers : []}
                readerDocScope={readerDocScope}
                onReaderDocScopeChange={setReaderDocScope}
                quotedPassage={quotedPassage}
                onClearQuotedPassage={() => setQuotedPassage(null)}
                isStreaming={thread.isStreaming}
                onSend={(text) => handleSend(text)}
                onStop={() => void thread.stop()}
              />
            </>
          )}
        </div>
      </aside>

      <ContextPicker
        open={Boolean(pickerTab)}
        onOpenChange={(open) => !open && setPickerTab(null)}
        initialTab={pickerTab ?? 'library'}
        spaceId={activeSpaceId}
        selectedIds={selectedIdSet}
        onSelect={(entries) => turnCtx.addSources(entries)}
      />
    </>
  );
}

export function CompanionDrawer() {
  const isOpen = useAiCompanionStore((s) => s.isOpen);
  const pathname = usePathname();

  if (!isOpen || pathname?.startsWith('/ai')) return null;
  return <CompanionDrawerInner />;
}

export default CompanionDrawer;
