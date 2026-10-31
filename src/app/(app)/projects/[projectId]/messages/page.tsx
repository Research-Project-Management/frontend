'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Hash,
  Plus,
  MessageSquare,
  Loader2,
  FolderKanban,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { useProject } from '@/features/projects/shell/hooks/use-project';
import { Switcher } from '@/features/projects/project-id/components/layout/Switcher';
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
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || '';

  const { state: projectState, isLoading: isProjectLoading } = useProject(projectId);
  const project = projectState?.project;

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
      {/* Top Header with Back Arrow and Project Switcher */}
      <header
        className="h-11 border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2.5 bg-transparent shrink-0 text-13 w-full min-w-0 select-none sticky top-0 z-20"
        style={{ paddingLeft: 'max(0.75rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {/* Back arrow navigating to project ID screen */}
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <Link
                href={backToProjectHref}
                className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                aria-label="Back to project work items"
              >
                <ArrowLeft className="size-4 shrink-0" strokeWidth={1.5} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start">
              Back to project (Work items)
            </TooltipContent>
          </Tooltip>

          <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />

          {/* Switcher breadcrumb */}
          {project ? (
            <Switcher
              project={{
                id: project.id,
                name: project.name,
                avatar: project.avatar,
              }}
              moduleTitle="Messages"
              moduleIcon={MessageSquare}
            />
          ) : isProjectLoading ? (
            <Skeleton className="h-6 w-36 rounded-md" />
          ) : (
            <div className="flex items-center gap-1.5 text-13 font-semibold text-foreground">
              <FolderKanban className="size-4 text-muted-foreground" />
              <span>Project Messages</span>
            </div>
          )}
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
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <span className="text-12 text-muted-foreground font-medium">Loading project discussion...</span>
          </div>
        ) : activeChannel ? (
          <ChatWindow
            conversation={activeChannel}
            backHref={backToProjectHref}
            showSidebarToggle={false}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageSquare className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-14 font-semibold text-foreground mb-1">
              No discussions yet
            </h3>
            <p className="text-12 text-muted-foreground max-w-sm mb-4">
              Start conversations and share ideas with team members working on this project.
            </p>
            <Button
              size="sm"
              onClick={() => openCreateChannelModal(projectId)}
              className="gap-1.5 h-8 text-12 font-medium cursor-pointer"
            >
              <Plus className="size-3.5" />
              Create #general channel
            </Button>
          </div>
        )}
      </div>

      {/* Modal Slot */}
      {isCreateChannelModalOpen && <CreateChannelModal />}
    </div>
  );
}
