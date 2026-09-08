'use client';

import React from 'react';
import { Plus, Wand2, History, Trash2, Check, X } from 'lucide-react';

interface AiTabHeaderProps {
  workspaceId: string | null | undefined;
  isStreaming: boolean;
  autoApply: boolean;
  onToggleAutoApply: () => void;
  onNewConversation: () => void;
  onOpenHistory: () => void;
  hasMessages: boolean;
  showClearConfirm: boolean;
  onShowClearConfirm: (show: boolean) => void;
  onClear: () => void;
  onClose?: () => void;
}

export function AiTabHeader({
  workspaceId,
  isStreaming,
  autoApply,
  onToggleAutoApply,
  onNewConversation,
  onOpenHistory,
  hasMessages,
  showClearConfirm,
  onShowClearConfirm,
  onClear,
  onClose,
}: AiTabHeaderProps) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
      <div className="flex items-center gap-2">
        <img src="/Chat.svg" alt="AI" className="size-4" />
        <span className="text-xs font-semibold text-muted-foreground">
          AI Assistant
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          onClick={onNewConversation}
          disabled={!workspaceId || isStreaming}
          title="New conversation"
          className="flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer disabled:cursor-not-allowed disabled:opacity-20"
        >
          <Plus className="size-3.5 shrink-0" />
        </button>

        {/* Auto Apply toggle */}
        <button
          onClick={onToggleAutoApply}
          title={
            autoApply
              ? 'Auto Apply ON — click to disable'
              : 'Auto Apply OFF — click to enable'
          }
          className={[
            'flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold transition-all cursor-pointer',
            autoApply
              ? 'bg-success/15 text-success border border-success/30 hover:bg-success/25'
              : 'text-foreground hover:bg-muted',
          ].join(' ')}
        >
          <Wand2 className="size-3 shrink-0" />
          <span className="hidden sm:inline">Auto</span>
        </button>

        <button
          onClick={onOpenHistory}
          disabled={!workspaceId}
          title="Show chat history"
          className="flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer disabled:cursor-not-allowed disabled:opacity-20"
        >
          <History className="size-3.5 shrink-0" />
        </button>

        {showClearConfirm ? (
          <div className="flex h-8 items-center gap-0.5 rounded-md border border-destructive/20 bg-destructive/10 px-1">
            <button
              onClick={onClear}
              title="Confirm clear chat"
              className="flex size-6 items-center justify-center rounded text-destructive hover:bg-destructive/15 transition-colors cursor-pointer"
            >
              <Check className="size-3.5 shrink-0" />
            </button>
            <button
              onClick={() => onShowClearConfirm(false)}
              title="Cancel"
              className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="size-3.5 shrink-0" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => hasMessages && onShowClearConfirm(true)}
            disabled={!hasMessages}
            title="Clear chat"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-20 cursor-pointer"
          >
            <Trash2 className="size-3.5 shrink-0" />
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer"
          >
            <X className="size-3.5 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
}
