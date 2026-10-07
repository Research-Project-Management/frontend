'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  SquarePen,
  History,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useAiCompanionStore } from '../../store/ai-companion.store';
import { useCompanionChat } from '../../hooks/use-companion-chat';
import { CompanionMessages } from './CompanionMessages';
import { CompanionInput } from './CompanionInput';
import { CompanionHistory } from './CompanionHistory';

export function AiCompanionSidebar() {
  const {
    isOpen,
    setOpen,
    width,
    setWidth,
    isHistoryView,
    toggleHistoryView,
    setHistoryView,
  } = useAiCompanionStore();

  const {
    messages,
    streamContent,
    isStreaming,
    isLoadingHistory,
    activeAgent,
    activeActions,
    sessionTitle,
    currentProjectId,
    messagesEndRef,
    scrollContainerRef,
    sendMessage,
    stopStreaming,
    startNewChat,
  } = useCompanionChat();

  const [promptToFill, setPromptToFill] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);
  const latestClientXRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Resize drag handle
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
    [width]
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
          // Provide live visual feedback down to 240px while dragging towards collapse threshold
          const liveClamped = Math.min(Math.max(rawWidth, 240), 640);
          setLiveWidth(liveClamped);
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

      // If dragged past collapse threshold (< 200px), smoothly collapse sidebar
      if (rawWidth < 200) {
        setOpen(false);
        setLiveWidth(null);
        setWidth(380);
      } else {
        const finalWidth = Math.min(Math.max(rawWidth, 280), 640);
        setWidth(finalWidth);
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

  const pathname = usePathname();
  const router = useRouter();

  // If closed or currently on the full /ai page, do not render companion sidebar
  if (!isOpen || pathname?.startsWith('/ai')) return null;

  const currentWidth = liveWidth ?? width;

  // Derive topbar title: default 'Flux AI', switch to chat title if user has chatted or session exists
  const firstUserMessage = messages.find((m) => m.role === 'user')?.content;
  const isGreeting =
    firstUserMessage &&
    /^(xin chào|chào bạn|chào|hello|hi|hey|alo)[!.,? ]*$/i.test(
      firstUserMessage.trim()
    );
  const chatTitle =
    sessionTitle && sessionTitle !== 'New Chat'
      ? sessionTitle
      : !isGreeting && firstUserMessage
        ? firstUserMessage.length > 36
          ? `${firstUserMessage.slice(0, 36)}...`
          : firstUserMessage
        : sessionTitle || 'AI Assistant';
  const displayTitle =
    (messages.length > 0 || sessionTitle) && chatTitle ? chatTitle : 'AI Assistant';

  return (
    <>
      {/* Mobile Backdrop Overlay (only on mobile) */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden animate-in fade-in duration-150 motion-reduce:animate-none"
        aria-hidden="true"
      />

      {/* Global drag overlay to prevent pointer capture or text selection during drag */}
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
          "flex flex-col bg-background relative pb-[env(safe-area-inset-bottom)]",
          // Mobile: slide-over sheet drawer
          "fixed inset-y-0 right-0 z-50 w-full sm:max-w-md shadow-lg border-l border-border animate-in slide-in-from-right duration-200 motion-reduce:animate-none motion-reduce:transform-none overflow-hidden",
          // Desktop: in-flow resizable column with visible overflow so edge resize and collapse controls aren't clipped
          "md:relative md:inset-auto md:z-auto md:order-3 md:h-full md:shrink-0 md:rounded-md md:border md:border-border md:shadow-none md:animate-none md:overflow-visible",
          isResizing && "transition-none select-none"
        )}
      >
        {/* Resizer handle on left border (desktop only) */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={currentWidth}
          aria-valuemin={280}
          aria-valuemax={640}
          aria-label="Drag to resize, double-click to reset (380px)"
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onDoubleClick={() => {
            setWidth(380);
            setLiveWidth(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setWidth(Math.min(640, width + 20));
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              setWidth(Math.max(280, width - 20));
            } else if (e.key === 'Home') {
              e.preventDefault();
              setWidth(280);
            } else if (e.key === 'End') {
              e.preventDefault();
              setWidth(640);
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setWidth(380);
            }
          }}
          className={cn(
            "hidden md:flex absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize items-center justify-center z-30 select-none group focus-visible:outline-none",
            isResizing && "pointer-events-auto"
          )}
        >
          {/* Visual vertical highlight line aligned directly with the card border */}
          <div
            className={cn(
              "w-0.5 h-full transition-colors duration-150 bg-transparent group-hover:bg-ai/60",
              isResizing && "bg-ai"
            )}
          />
        </div>

        {/* Inner container to clip internal content (header, messages, input) without clipping edge handles */}
        <div className="flex flex-col h-full w-full min-h-0 overflow-hidden rounded-[inherit]">

      {/* Header */}
      {isHistoryView ? (
        <header className='flex h-11 items-center justify-between px-2.5 sm:px-3 border-b border-border bg-transparent shrink-0 select-none'>
          <span className='font-semibold text-13 text-foreground tracking-tight'>
            Chat history
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                onClick={() => setHistoryView(false)}
                className='relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai before:absolute before:-inset-1.5 md:before:hidden'
                aria-label='Back to chat'
              >
                <ChevronRight className='size-4 shrink-0 text-foreground' />
              </button>
            </TooltipTrigger>
            <TooltipContent side='bottom' sideOffset={4}>
              Back to chat
            </TooltipContent>
          </Tooltip>
        </header>
      ) : (
        <header className='flex h-11 items-center justify-between px-2.5 sm:px-3 border-b border-border bg-transparent shrink-0 select-none'>
          {/* Left: Title */}
          <div className='flex items-center gap-2 min-w-0 flex-1 mr-2'>
            <span
              className='font-semibold text-13 text-foreground tracking-tight truncate'
              title={displayTitle}
            >
              {displayTitle}
            </span>
          </div>

          {/* Right: Actions (New Chat, History, Close) */}
          <div className='flex items-center gap-0.5 shrink-0'>
            {/* New Chat */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  onClick={() => {
                    startNewChat();
                    setHistoryView(false);
                  }}
                  className='relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai before:absolute before:-inset-1.5 md:before:hidden'
                  aria-label='New chat'
                >
                  <SquarePen className='size-3.5 shrink-0 text-foreground' />
                </button>
              </TooltipTrigger>
              <TooltipContent side='bottom' sideOffset={4}>
                New chat
              </TooltipContent>
            </Tooltip>

            {/* Toggle History */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  onClick={toggleHistoryView}
                  className={cn(
                    'relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai before:absolute before:-inset-1.5 md:before:hidden',
                    isHistoryView && 'bg-muted'
                  )}
                  aria-label='Chat history'
                >
                  <History className='size-3.5 shrink-0 text-foreground' />
                </button>
              </TooltipTrigger>
              <TooltipContent side='bottom' sideOffset={4}>
                Chat history
              </TooltipContent>
            </Tooltip>

            {/* Close Sidebar */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  onClick={() => setOpen(false)}
                  className='relative flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai before:absolute before:-inset-1.5 md:before:hidden'
                  aria-label='Collapse (Ctrl+J)'
                >
                  <X className='size-3.5 shrink-0 text-foreground' />
                </button>
              </TooltipTrigger>
              <TooltipContent side='bottom' sideOffset={4}>
                Collapse (Ctrl+J)
              </TooltipContent>
            </Tooltip>
          </div>
        </header>
      )}

      {/* Body: Switch between History, Documents, and Messages */}
      {isHistoryView ? (
        <CompanionHistory
          currentProjectId={currentProjectId}
          onNewChat={() => {
            startNewChat();
            setHistoryView(false);
          }}
        />
      ) : (
        <>
          <CompanionMessages
            messages={messages}
            streamContent={streamContent}
            isStreaming={isStreaming}
            isLoadingHistory={isLoadingHistory}
            activeAgent={activeAgent}
            activeActions={activeActions}
            messagesEndRef={messagesEndRef}
            scrollContainerRef={scrollContainerRef}
            onSelectPrompt={(p) => setPromptToFill(p)}
          />

          <CompanionInput
            currentProjectId={currentProjectId}
            onSend={(text, options) => {
              sendMessage(text, options);
              setPromptToFill('');
            }}
            onStop={stopStreaming}
            isStreaming={isStreaming}
            initialText={promptToFill}
          />
        </>
      )}
        </div>
    </aside>

  </>
  );
}
export default AiCompanionSidebar;
