'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Hash,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { useProjectChannels } from '@/features/chat/hooks/use-chat-queries';
import { useChatStore } from '@/features/chat/store/chat.store';
import { ConversationItem } from '@/features/chat/types/chat.types';
import { cn } from '@/shared/lib/utils';

const CreateChannelModal = dynamic(
  () => import('@/features/chat/components/CreateChannelModal').then((m) => m.CreateChannelModal),
  { ssr: false }
);

export default function ProjectMessagesPage() {
  useEffect(() => {
    document.title = 'Messages · Flux';
  }, []);

  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || '';

  const {
    data: projectChannels = [],
    isLoading: isChannelsLoading,
  } = useProjectChannels(projectId);

  const {
    openCreateChannelModal,
    isCreateChannelModalOpen,
  } = useChatStore();

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // Sync active channel to default or first available channel
  const activeChannel = useMemo<ConversationItem | null>(() => {
    if (projectChannels.length === 0) return null;
    if (selectedChannelId) {
      const found = projectChannels.find((c) => c.id === selectedChannelId);
      if (found) return found;
    }
    const defaultChan = projectChannels.find((c) => c.isDefault);
    return defaultChan || projectChannels[0] || null;
  }, [projectChannels, selectedChannelId]);

  useEffect(() => {
    if (activeChannel && !selectedChannelId) {
      setSelectedChannelId(activeChannel.id);
    }
  }, [activeChannel, selectedChannelId]);

  const backToProjectHref = `/projects/${projectId}/work-items`;

  return (
    <div className="flex-1 flex min-h-0 flex-col h-full bg-background overflow-hidden select-none">
      {/* Top Header */}
      <header
        className="h-11 border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2.5 bg-transparent shrink-0 text-13 w-full min-w-0 select-none sticky top-0 z-20"
        style={{ paddingLeft: 'max(0.75rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <MessageSquare className="size-4 text-foreground shrink-0" strokeWidth={1.75} />
          <h1 className="text-13 font-semibold text-foreground tracking-tight truncate">
            Messages
          </h1>
        </div>

        {/* Project Channels selector / actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {projectChannels.length > 1 && (
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md border border-border/50">
              {projectChannels.map((ch) => {
                const isActive = activeChannel?.id === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChannelId(ch.id)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded text-12 font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Hash className="size-3 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[100px]">{ch.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openCreateChannelModal(projectId)}
                className="h-7 px-2 text-12 font-medium gap-1 rounded-md cursor-pointer border-border hover:bg-muted text-foreground"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Channel</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Create new channel</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Main Messaging Canvas */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        {isChannelsLoading ? (
          <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="size-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-24 rounded-sm" />
                    <Skeleton className="h-3 w-12 rounded-sm opacity-60" />
                  </div>
                  <Skeleton className="h-3.5 w-3/4 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : activeChannel ? (
          <ChatWindow
            conversation={activeChannel}
            backHref={backToProjectHref}
            showSidebarToggle={false}
          />
        ) : (
          <PlaneEmptyState
            variant="document"
            title="No discussions yet"
            description="Start conversations and share ideas with team members working on this project."
            action={
              <Button
                size="sm"
                onClick={() => openCreateChannelModal(projectId)}
                className="gap-1.5 h-8 text-12 font-medium cursor-pointer"
              >
                <Plus className="size-3.5" />
                Create #general channel
              </Button>
            }
          />
        )}
      </div>

      {/* Modal Slot */}
      {isCreateChannelModalOpen && <CreateChannelModal />}
    </div>
  );
}
