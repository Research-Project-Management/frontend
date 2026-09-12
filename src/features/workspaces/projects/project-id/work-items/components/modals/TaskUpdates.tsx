'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Activity, Plus, Trash2, CheckCircle2, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from "@/shared/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import { UpdateService, type WorkItemUpdateRecord } from '../../services/service';
import { cn } from "@/shared/lib/utils";

export interface TaskUpdatesProps {
  taskId: string;
  projectId?: string;
  isReadOnly?: boolean;
  onUpdateChanged?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; badgeClass: string }> = {
  on_track: {
    label: 'On Track',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  at_risk: {
    label: 'At Risk',
    icon: AlertTriangle,
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  delayed: {
    label: 'Delayed',
    icon: Clock,
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
  },
};

export function TaskUpdates({
  taskId,
  projectId,
  isReadOnly = false,
  onUpdateChanged,
}: TaskUpdatesProps) {
  const [updates, setUpdates] = useState<WorkItemUpdateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [content, setContent] = useState('');
  const [percent, setPercent] = useState<number>(50);
  const [status, setStatus] = useState<string>('on_track');

  const fetchUpdates = useCallback(async () => {
    if (!taskId) return;
    setIsLoading(true);
    try {
      const records = await UpdateService.getUpdates(taskId, projectId);
      setUpdates(records);
    } catch {
      // Silently catch error
    } finally {
      setIsLoading(false);
    }
  }, [taskId, projectId]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Please enter a brief progress description');
      return;
    }

    setIsPosting(true);
    try {
      await UpdateService.createUpdate(
        taskId,
        {
          content: content.trim(),
          percent: Number(percent),
          status,
        },
        projectId,
      );
      toast.success('Progress briefing posted');
      setContent('');
      setShowPostForm(false);
      await fetchUpdates();
      onUpdateChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post update');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    try {
      await UpdateService.deleteUpdate(taskId, updateId, projectId);
      toast.success('Update removed');
      setUpdates((prev) => prev.filter((u) => u.id !== updateId));
      onUpdateChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete update');
    }
  };

  const latestUpdate = updates[0] || null;

  return (
    <div className="space-y-3 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-11 font-semibold text-muted-foreground">
            Progress Briefings ({updates.length})
          </span>
          {latestUpdate && typeof latestUpdate.percent === 'number' && (
            <span className="text-10 font-semibold px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
              {latestUpdate.percent}% Complete
            </span>
          )}
        </div>

        {!isReadOnly && !showPostForm && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPostForm(true)}
            className="h-6 px-2 text-xs font-medium text-foreground hover:bg-muted rounded-md flex items-center gap-1 cursor-pointer shadow-none"
          >
            <Plus className="size-3" />
            <span>Post update</span>
          </Button>
        )}
      </div>

      {/* Post Update Form */}
      {showPostForm && !isReadOnly && (
        <form
          onSubmit={handlePostUpdate}
          className="p-3 rounded-md border border-border bg-card/60 space-y-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <TrendingUp className="size-3.5" />
              New Milestone Briefing
            </span>
            <button
              type="button"
              onClick={() => setShowPostForm(false)}
              className="text-10 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Summary of recent research progress or blockers..."
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-background p-2 text-xs text-foreground outline-none focus:border-primary transition-colors leading-relaxed"
              autoFocus
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
              {/* Status Selector */}
              <div>
                <label className="text-10 font-medium text-muted-foreground block mb-1">Status</label>
                <div className="flex items-center gap-1">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                    const isSelected = status === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStatus(key)}
                        className={cn(
                          "px-2 py-1 rounded text-10 font-medium border transition-colors cursor-pointer",
                          isSelected
                            ? cfg.badgeClass
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Percent Slider/Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-10 font-medium text-muted-foreground">Progress Completion</label>
                  <span className="text-11 font-bold text-foreground tabular-nums">{percent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-1.5 pt-1 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPostForm(false)}
              className="h-7 text-xs px-2.5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPosting || !content.trim()}
              className="h-7 text-xs px-3 font-medium"
            >
              {isPosting ? 'Posting...' : 'Post Briefing'}
            </Button>
          </div>
        </form>
      )}

      {/* Loading Skeleton */}
      {isLoading && updates.length === 0 && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      )}

      {/* List of Updates */}
      {!isLoading && updates.length === 0 && !showPostForm && (
        <div className="py-2.5 px-3 rounded-md border border-dashed border-border text-center">
          <p className="text-xs text-muted-foreground">No progress updates recorded yet.</p>
        </div>
      )}

      {updates.length > 0 && (
        <div className="divide-y divide-border rounded-md border border-border bg-background overflow-hidden">
          {updates.map((update) => {
            const statusInfo = update.status ? STATUS_CONFIG[update.status] : null;
            const authorName = update.user?.name || 'Lab Member';
            const authorAvatar = update.user?.avatar;
            const dateStr = update.createdAt
              ? format(new Date(update.createdAt), 'MMM d, yyyy · HH:mm')
              : '';

            return (
              <div
                key={update.id}
                className="p-3 text-xs hover:bg-muted/40 transition-colors space-y-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-4 shrink-0">
                      <AvatarImage src={authorAvatar || undefined} />
                      <AvatarFallback className="text-9 font-medium">
                        {authorName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-foreground text-xs">{authorName}</span>
                    <span className="text-10 text-muted-foreground">{dateStr}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {statusInfo && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-10 font-medium border flex items-center gap-1",
                          statusInfo.badgeClass
                        )}
                      >
                        <statusInfo.icon className="size-3 shrink-0" />
                        <span>{statusInfo.label}</span>
                      </span>
                    )}

                    {typeof update.percent === 'number' && (
                      <span className="text-10 font-bold px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
                        {update.percent}%
                      </span>
                    )}

                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUpdate(update.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-opacity cursor-pointer ml-1"
                        title="Delete update"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-foreground text-xs leading-relaxed whitespace-pre-wrap pl-6">
                  {update.content}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
