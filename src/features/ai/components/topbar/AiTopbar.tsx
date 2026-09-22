'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PanelLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui';
import { AIIcon } from '@/shared/components/icons';
import { useAiUIStore } from '../../store';
import { getChatSession } from '../../services/chat.service';

export interface AiTopbarProps {
  title?: string;
  className?: string;
}

export function AiTopbar({ title: propTitle, className }: AiTopbarProps) {
  const router = useRouter();
  const { chatId } = useParams<{ chatId?: string }>();
  const { isSidebarOpen, toggleSidebar } = useAiUIStore();
  const [chatTitle, setChatTitle] = useState(propTitle || '');

  React.useEffect(() => {
    if (propTitle) {
      setChatTitle(propTitle);
      return;
    }
    if (chatId) {
      getChatSession(chatId)
        .then((s) => {
          if (s?.title) setChatTitle(s.title);
        })
        .catch(() => {});
    } else {
      setChatTitle('');
    }
  }, [chatId, propTitle]);

  return (
    <header
      className={cn(
        'flex items-center justify-between border-b border-border bg-background px-3.5 h-11 sticky top-0 z-10 shrink-0 select-none',
        className,
      )}
    >
      {/* ── Left Section: Sidebar Toggle (chỉ khi sidebar đóng) + AIIcon + Flux AI Breadcrumb ───────────────── */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Toggle Sidebar Button — chỉ hiện khi sidebar đang đóng để người dùng mở lại */}
        {!isSidebarOpen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebar}
                className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary mr-0.5"
                aria-label="Open sidebar"
              >
                <PanelLeft className="size-4 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Open sidebar
            </TooltipContent>
          </Tooltip>
        )}

        {/* Brand & Breadcrumb: AIIcon + Flux AI */}
        <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => router.push('/ai')}
            className="flex items-center gap-1.5 text-foreground font-semibold text-13 tracking-tight hover:opacity-80 transition-opacity cursor-pointer outline-none"
          >
            <AIIcon className="size-4 shrink-0 text-foreground" />
            <span>Flux AI</span>
          </button>

          {chatId && (
            <>
              <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
              <span
                className="text-13 text-muted-foreground font-normal truncate max-w-64"
                title={chatTitle || 'Conversation'}
              >
                {chatTitle || 'Conversation'}
              </span>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default AiTopbar;
