'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Activity, Plus, Trash2, CheckCircle2, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import {
  useUpdatesQuery,
  useCreateUpdateMutation,
  useDeleteUpdateMutation,
} from '../../hooks/use-update';
import type { WorkItemUpdateRecord } from '../../services/update.service';
import { cn } from "@/shared/lib/utils";

export interface UpdatesProps {
  itemId?: string;
  workItemId?: string;
  taskId?: string;
  projectId?: string;
  isReadOnly?: boolean;
  onUpdateChanged?: () => void;
}
export type WorkItemUpdatesProps = UpdatesProps;
export type TaskUpdatesProps = UpdatesProps;

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

export function WorkItemUpdates({
  itemId,
  workItemId,
  taskId,
  projectId,
  isReadOnly = false,
  onUpdateChanged,
}: UpdatesProps) {
  const effectiveId = (itemId || workItemId || taskId) ?? '';
  const { data: updates = [], isLoading } = useUpdatesQuery(effectiveId, projectId);
  const createMutation = useCreateUpdateMutation();
  const deleteMutation = useDeleteUpdateMutation();

  const [isAdding, setIsAdding] = useState(false);
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'on_track' | 'at_risk' | 'delayed' | 'completed'>('on_track');
  const [percent, setPercent] = useState<number>(0);

  const handleCreate = async () => {
    if (!content.trim() || !effectiveId) return;
    await createMutation.mutateAsync({
      itemId: effectiveId,
      projectId,
      data: { content: content.trim(), status, percent: percent > 0 ? percent : undefined },
    });
    setContent('');
    setIsAdding(false);
    onUpdateChanged?.();
  };

  const handleDelete = async (updateId: string) => {
    if (!effectiveId) return;
    await deleteMutation.mutateAsync({
      itemId: effectiveId,
      updateId,
      projectId,
    });
    onUpdateChanged?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Progress Updates
          </h4>
        </div>
        {!isReadOnly && !isAdding && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="h-7 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Post update</span>
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="p-3 border border-border rounded-md bg-muted/30 space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share a quick progress update..."
            className="w-full text-xs bg-background border border-border rounded p-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none h-20"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-11 text-muted-foreground">Status:</span>
              <div className="flex items-center gap-1">
                {(['on_track', 'at_risk', 'delayed', 'completed'] as const).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        'px-2 py-1 text-10 rounded border flex items-center gap-1 transition-colors',
                        status === s
                          ? cfg.badgeClass
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="size-3" />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-11 text-muted-foreground">Percent:</span>
              <input
                type="number"
                min={0}
                max={100}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className="w-14 h-6 text-xs bg-background border border-border rounded px-1 text-center"
              />
              <span className="text-11 text-muted-foreground">%</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={!content.trim() || createMutation.isPending}
              className="h-7 text-xs"
            >
              {createMutation.isPending ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded" />
          <Skeleton className="h-14 w-full rounded" />
        </div>
      ) : updates.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No updates recorded yet.</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {updates.map((u: WorkItemUpdateRecord) => {
            const statusCfg = u.status ? STATUS_CONFIG[u.status] : null;
            const StatusIcon = statusCfg?.icon;

            return (
              <div
                key={u.id}
                className="group relative p-2.5 border border-border rounded-md bg-background text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-5">
                      {u.user?.avatar && <AvatarImage src={u.user.avatar} />}
                      <AvatarFallback className="text-10">
                        {u.user?.name?.slice(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{u.user?.name || 'User'}</span>
                    <span className="text-10 text-muted-foreground">
                      {format(new Date(u.createdAt), 'MMM d, HH:mm')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {statusCfg && StatusIcon && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-10 border flex items-center gap-1',
                          statusCfg.badgeClass
                        )}
                      >
                        <StatusIcon className="size-3" />
                        <span>{statusCfg.label}</span>
                      </span>
                    )}
                    {u.percent !== null && u.percent !== undefined && (
                      <span className="text-10 text-muted-foreground flex items-center gap-0.5">
                        <TrendingUp className="size-3 text-primary" />
                        <span>{u.percent}%</span>
                      </span>
                    )}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleDelete(u.id)}
                        disabled={deleteMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground transition-opacity cursor-pointer p-0.5"
                        title="Delete update"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-muted-foreground whitespace-pre-wrap">{u.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const Updates = WorkItemUpdates;
export const TaskUpdates = WorkItemUpdates;
export default WorkItemUpdates;
