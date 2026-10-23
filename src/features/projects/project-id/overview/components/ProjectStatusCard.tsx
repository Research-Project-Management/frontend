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
  Clock,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { AddStatusUpdateModal } from './AddStatusUpdateModal';
import {
  useProjectStatusUpdates,
  useCreateProjectStatusUpdate,
  useDeleteProjectStatusUpdate,
} from '../hooks/use-project-overview';
import { toast } from 'sonner';

interface ProjectStatusCardProps {
  projectId: string;
  currentUpdate: ProjectStatusUpdate | null;
  isModalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
}

const STATUS_CONFIG: Record<
  ProjectStatusIndicator,
  {
    label: string;
    sublabel: string;
    badgeClass: string;
    icon: React.ElementType;
    iconColor: string;
    indicatorDot: string;
  }
> = {
  on_track: {
    label: 'On Track',
    sublabel: 'Progressing according to schedule with no major blockers',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    indicatorDot: 'bg-emerald-500',
  },
  at_risk: {
    label: 'At Risk',
    sublabel: 'Emerging blockers or risks need attention from the team',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    indicatorDot: 'bg-amber-500',
  },
  off_track: {
    label: 'Off Track',
    sublabel: 'Critical delays or blockers currently impacting deliverables',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: AlertOctagon,
    iconColor: 'text-destructive',
    indicatorDot: 'bg-destructive',
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
  isModalOpen: controlledModalOpen,
  onModalOpenChange: setControlledModalOpen,
}: ProjectStatusCardProps) {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const isModalOpen =
    controlledModalOpen !== undefined ? controlledModalOpen : internalModalOpen;
  const setIsModalOpen =
    setControlledModalOpen !== undefined
      ? setControlledModalOpen
      : setInternalModalOpen;

  const { data: updatesList } = useProjectStatusUpdates(projectId);
  const createUpdateMutation = useCreateProjectStatusUpdate(projectId);
  const deleteUpdateMutation = useDeleteProjectStatusUpdate(projectId);

  const activeStatus = currentUpdate?.status || 'on_track';
  const config = currentUpdate ? STATUS_CONFIG[activeStatus] : null;

  const handleDeleteUpdate = async (updateId: string) => {
    try {
      await deleteUpdateMutation.mutateAsync(updateId);
      toast.success('Status update deleted');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete status update',
      );
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5 flex flex-col gap-3.5 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
              <Clock className="size-3.5" />
            </div>
            <h2 className="text-13 font-semibold tracking-tight text-foreground">
              Project Health & Status
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {updatesList && updatesList.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="h-7 px-2 text-12 font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <History className="size-3.5 mr-1" />
                <span>History ({updatesList.length})</span>
                {showHistory ? (
                  <ChevronUp className="size-3 ml-1" />
                ) : (
                  <ChevronDown className="size-3 ml-1" />
                )}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="h-7 px-2.5 text-12 font-medium border-border hover:bg-muted text-foreground cursor-pointer"
            >
              <Plus className="size-3 mr-1" />
              <span>Update Status</span>
            </Button>
          </div>
        </div>

        {/* Current Status Content */}
        {currentUpdate && config ? (
          <div className="rounded-md bg-muted/30 p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`px-2 py-0.5 text-11 font-medium gap-1.5 ${config.badgeClass}`}
                >
                  <span className={`size-1.5 rounded-full ${config.indicatorDot}`} />
                  <span>{config.label}</span>
                </Badge>
                <span className="text-12 text-muted-foreground">
                  {config.sublabel}
                </span>
              </div>

              <div className="flex items-center gap-2 text-12 text-muted-foreground">
                <span className="font-mono">
                  {formatRelativeTime(currentUpdate.createdAt)}
                </span>
                {currentUpdate.author?.name && (
                  <span>by {currentUpdate.author.name}</span>
                )}
              </div>
            </div>

            {currentUpdate.message && (
              <p className="text-13 text-foreground/90 leading-relaxed pt-1 border-t border-border/40 whitespace-pre-wrap">
                {currentUpdate.message}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border/80 bg-muted/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex flex-col gap-0.5">
              <span className="text-13 font-medium text-foreground">
                No status update posted yet
              </span>
              <span className="text-12 text-muted-foreground">
                Keep your team aligned by posting a quick update on current project health and milestones.
              </span>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="h-8 px-3 text-12 font-medium shrink-0 cursor-pointer"
            >
              <Plus className="size-3.5 mr-1.5" />
              <span>Post first update</span>
            </Button>
          </div>
        )}

        {/* Historical Updates Drawer / List */}
        {showHistory && updatesList && updatesList.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
            <span className="text-11 font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Previous Updates
            </span>
            <div className="flex flex-col divide-y divide-border/40 max-h-60 overflow-y-auto pr-1">
              {updatesList.map((item) => {
                const itemCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.on_track;
                const ItemIcon = itemCfg.icon;
                return (
                  <div
                    key={item.id}
                    className="py-2.5 px-2 flex items-start justify-between gap-3 hover:bg-muted/30 rounded-md transition-colors group"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <ItemIcon
                        className={`size-4 shrink-0 mt-0.5 ${itemCfg.iconColor}`}
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-12 font-medium text-foreground">
                            {itemCfg.label}
                          </span>
                          <span className="text-12 text-muted-foreground font-mono">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                          {item.author?.name && (
                            <span className="text-12 text-muted-foreground">
                              &bull; {item.author.name}
                            </span>
                          )}
                        </div>
                        {item.message && (
                          <p className="text-12 text-muted-foreground mt-0.5 line-clamp-2">
                            {item.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteUpdate(item.id)}
                      className="size-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                      title="Delete this update"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <AddStatusUpdateModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSubmit={async (data) => {
          await createUpdateMutation.mutateAsync(data);
        }}
      />
    </>
  );
}
