'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  History,
  X,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui';
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
  const [isMobile, setIsMobile] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

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
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    },
    [width]
  );

  useEffect(() => {
    if (!isResizing) return;

    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        const delta = startXRef.current - e.clientX;
        const newWidth = Math.min(Math.max(startWidthRef.current + delta, 320), 720);
        setWidth(newWidth);
        rafId = null;
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setWidth]);

  // If closed, do not render
  if (!isOpen) return null;

  // Derive topbar title: default 'Flux AI', switch to chat title if user has chatted or session exists
  const firstUserMessage = messages.find((m) => m.role === 'user')?.content;
  const chatTitle =
    sessionTitle ||
    (firstUserMessage
      ? firstUserMessage.length > 36
        ? `${firstUserMessage.slice(0, 36)}...`
        : firstUserMessage
      : '');
  const displayTitle =
    (messages.length > 0 || sessionTitle) && chatTitle ? chatTitle : 'Flux AI';

  return (
    <>
      {/* Mobile Backdrop Overlay (only on mobile) */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden animate-in fade-in duration-150"
        aria-hidden="true"
      />

      <aside
        style={isMobile ? undefined : { width: `${width}px` }}
        aria-label="Flux AI Companion Sidebar"
        className={cn(
          "flex flex-col bg-background overflow-hidden relative pb-[env(safe-area-inset-bottom)]",
          // Mobile: slide-over sheet drawer
          "fixed inset-y-0 right-0 z-50 w-full sm:max-w-md shadow-2xl border-l border-border animate-in slide-in-from-right duration-200",
          // Desktop: in-flow resizable column
          "md:static md:inset-auto md:z-auto md:order-3 md:h-full md:shrink-0 md:rounded-md md:border md:shadow-2xs md:transition-[width] md:duration-75"
        )}
      >
        {/* Resizer handle on left border (desktop only) */}
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "hidden md:block absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-20",
            isResizing && "bg-primary"
          )}
          title="Drag to resize sidebar"
        />

      {/* Header */}
      <div className='flex h-11 items-center justify-between px-3 border-b border-border bg-background shrink-0 select-none'>
        {/* Left: Title */}
        <div className='flex items-center min-w-0 flex-1 mr-2'>
          <span
            className='font-semibold text-13 text-foreground tracking-tight truncate'
            title={displayTitle}
          >
            {displayTitle}
          </span>
        </div>

        {/* Right: Actions */}
        <div className='flex items-center gap-1 shrink-0'>
          {/* New Chat */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                onClick={() => {
                  startNewChat();
                  setHistoryView(false);
                }}
                className='flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary'
                aria-label='New Chat'
              >
                <Plus className='size-4 shrink-0' />
              </button>
            </TooltipTrigger>
            <TooltipContent side='bottom' sideOffset={4}>
              New Chat
            </TooltipContent>
          </Tooltip>

          {/* Toggle History */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                onClick={toggleHistoryView}
                className={cn(
                  'flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                  isHistoryView
                    ? 'bg-accent text-primary'
                    : 'text-foreground hover:bg-muted'
                )}
                aria-label='Chat History'
              >
                <History className='size-3.5 shrink-0' />
              </button>
            </TooltipTrigger>
            <TooltipContent side='bottom' sideOffset={4}>
              Chat History
            </TooltipContent>
          </Tooltip>

          {/* Close Sidebar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                onClick={() => setOpen(false)}
                className='flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted hover:text-destructive cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary'
                aria-label='Close Sidebar'
              >
                <X className='size-4 shrink-0' />
              </button>
            </TooltipTrigger>
            <TooltipContent side='bottom' sideOffset={4}>
              Close (Cmd+J)
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Body: Switch between History and Messages */}
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
    </aside>
  </>
  );
}
export default AiCompanionSidebar;
