'use client';

import React, { useState } from 'react';
import {
  ProjectStatusUpdate,
  ProjectStatusIndicator,
} from '../types/overview.types';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Plus,
  History,
  Trash2,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { AddStatusUpdateModal } from './AddStatusUpdateModal';
import { useProjectStatusUpdates, useCreateProjectStatusUpdate, useDeleteProjectStatusUpdate } from '../hooks/use-project-overview';
import { toast } from 'sonner';

interface ProjectStatusCardProps {
  projectId: string;
  currentUpdate: ProjectStatusUpdate | null;
}

const STATUS_CONFIG: Record<
  ProjectStatusIndicator,
  {
    label: string;
    sublabel: string;
    badgeClass: string;
    icon: React.ElementType;
    iconColor: string;
    borderClass: string;
    bgGradient: string;
  }
> = {
  on_track: {
    label: 'On Track',
    sublabel: 'Progressing according to schedule with no major blockers',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-500/20 hover:border-emerald-500/40',
    bgGradient: 'from-emerald-500/5 via-background to-background',
  },
  at_risk: {
    label: 'At Risk',
    sublabel: 'Emerging blockers or risks need attention from the team',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    icon: AlertTriangle,
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500/20 hover:border-amber-500/40',
    bgGradient: 'from-amber-500/5 via-background to-background',
  },
  off_track: {
    label: 'Off Track',
    sublabel: 'Critical delays or blockers currently impacting deliverables',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    icon: AlertOctagon,
    iconColor: 'text-rose-600 dark:text-rose-400',
    borderClass: 'border-rose-500/20 hover:border-rose-500/40',
    bgGradient: 'from-rose-500/5 via-background to-background',
  },
};

function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function ProjectStatusCard({
  projectId,
  currentUpdate,
}: ProjectStatusCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: updatesList } = useProjectStatusUpdates(projectId);
  const createUpdateMutation = useCreateProjectStatusUpdate(projectId);
  const deleteUpdateMutation = useDeleteProjectStatusUpdate(projectId);

  const activeStatus = currentUpdate?.status || 'on_track';
  const config = currentUpdate ? STATUS_CONFIG[activeStatus] : null;

  const handleDeleteUpdate = async (updateId: string) => {
    try {
      await deleteUpdateMutation.mutateAsync(updateId);
      toast.success('Status update deleted', { id: 'project-status-update' });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete status update', { id: 'project-status-update' });
    }
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Project Status & Health
            </h3>
            {currentUpdate && config && (
              <Badge
                variant="outline"
                className={`text-[11px] font-semibold gap-1 py-0.5 px-2 ${config.badgeClass}`}
              >
                <config.icon className="size-3" />
                {config.label}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {updatesList && updatesList.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
              >
                <History className="size-3.5" />
                {showHistory ? 'Hide History' : `History (${updatesList.length})`}
                {showHistory ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="h-7 text-xs gap-1 px-2.5 font-medium"
            >
              <Plus className="size-3.5" />
              Post Update
            </Button>
          </div>
        </div>

        {/* Current / Latest Status Banner */}
        {currentUpdate && config ? (
          <div
            className={`rounded-lg border bg-gradient-to-br ${config.bgGradient} ${config.borderClass} p-4 transition-all flex flex-col gap-3`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-md bg-background/80 shadow-xs ${config.iconColor}`}>
                  <config.icon className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {config.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      • {formatRelativeTime(currentUpdate.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {config.sublabel}
                  </p>
                </div>
              </div>
            </div>

            {/* Message Body */}
            <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed pl-1">
              {currentUpdate.message}
            </div>

            {/* Author Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="size-4 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {currentUpdate.author.avatar ? (
                    <img
                      src={currentUpdate.author.avatar}
                      alt={currentUpdate.author.name || ''}
                      className="size-full object-cover"
                    />
                  ) : (
                    <User className="size-2.5" />
                  )}
                </div>
                <span>
                  Updated by{' '}
                  <span className="font-medium text-foreground">
                    {currentUpdate.author.name || 'Team member'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-border/70 rounded-lg p-4 bg-muted/10">
            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-2">
              <CheckCircle2 className="size-4" />
            </div>
            <p className="text-xs font-medium text-foreground">
              No status updates yet
            </p>
            <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
              Keep collaborators and stakeholders informed about milestones, progress, and blockers.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="mt-3 text-xs gap-1.5 h-7"
            >
              <Plus className="size-3" />
              Post first status update
            </Button>
          </div>
        )}

        {/* Historical Timeline (Collapsible) */}
        {showHistory && updatesList && updatesList.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Update Timeline History
            </span>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              {updatesList.map((item) => {
                const itemConfig = STATUS_CONFIG[item.status];
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1.5 p-3 rounded-lg border border-border/60 bg-muted/20 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium py-0 px-1.5 gap-1 ${itemConfig.badgeClass}`}
                        >
                          <itemConfig.icon className="size-2.5" />
                          {itemConfig.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          by {item.author.name || 'Member'}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteUpdate(item.id)}
                        className="size-6 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-foreground/80 whitespace-pre-wrap">
                      {item.message}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <AddStatusUpdateModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSubmit={async (input) => {
          await createUpdateMutation.mutateAsync(input);
        }}
      />
    </>
  );
}
