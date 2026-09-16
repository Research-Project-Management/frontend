'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Item, Column } from '../../types/work-item.types';
import type { AssigneeFilterOption } from '../../hooks/use-topbar';
import { AnalyticsService } from '../../services/analytics.service';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Skeleton,
  Badge,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui';
import { BarChart3, TrendingUp, Users, CheckCircle2 } from 'lucide-react';

export interface AnalyticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project?: any;
  projectId?: string;
  items?: Item[];
  columns?: Column[];
  assignees?: AssigneeFilterOption[];
  [key: string]: any;
}

export function AnalyticsDrawer({
  isOpen,
  onClose,
  project,
  projectId,
  items = [],
  columns = [],
}: AnalyticsDrawerProps) {
  const currentProjectId = projectId || project?.id || project?.identifier;

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['project-analytics-dist', currentProjectId],
    queryFn: () => AnalyticsService.getProjectAnalytics(currentProjectId!),
    enabled: Boolean(isOpen && currentProjectId),
    staleTime: 60 * 1000,
  });

  const totalItems = analytics?.totalItems ?? items.length;
  const completedItems =
    analytics?.completedItems ??
    items.filter((t) => t.completed || t.stateGroup === 'completed').length;
  const completionRate =
    analytics?.completionRate ??
    (totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 bg-background border-border flex flex-col"
      >
        <SheetHeader className="px-5 py-4 border-b border-border text-left shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-foreground shrink-0" />
            <SheetTitle className="text-sm font-semibold text-foreground tracking-tight">
              Work item analytics
            </SheetTitle>
            <Badge
              variant="outline"
              className="text-10 font-normal px-1.5 py-0 h-4 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
            >
              Live SSOT
            </Badge>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Hiệu suất và tổng quan tiến độ các công việc trong dự án theo thời gian thực.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Top Quick Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-md border border-border bg-card space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Items</span>
                <BarChart3 className="size-3.5 text-muted-foreground shrink-0" />
              </div>
              <div className="text-xl font-semibold text-foreground font-mono">
                {isLoading ? <Skeleton className="h-7 w-12" /> : totalItems}
              </div>
              <p className="text-10 text-muted-foreground">Toàn bộ work items</p>
            </div>

            <div className="p-3 rounded-md border border-border bg-card space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Completion</span>
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
              </div>
              <div className="text-xl font-semibold text-foreground font-mono">
                {isLoading ? <Skeleton className="h-7 w-16" /> : `${completionRate}%`}
              </div>
              <p className="text-10 text-muted-foreground">
                {completedItems}/{totalItems} hoàn thành
              </p>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="p-4 rounded-md border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Phân bổ theo trạng thái</span>
              <span className="text-10 text-muted-foreground font-mono">Workflow distribution</span>
            </div>
            <div className="space-y-2.5 pt-1">
              {columns.map((col) => {
                const count = analytics?.state
                  ? analytics.state[col.id] || 0
                  : items.filter((t) => t.columnId === col.id).length;
                const pct = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
                return (
                  <div key={col.id} className="space-y-1">
                    <div className="flex justify-between text-11 text-muted-foreground">
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: col.color || col.accentColor || '#8A9093',
                          }}
                        />
                        {col.title || col.name}
                      </span>
                      <span className="font-mono">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            col.color || col.accentColor || 'var(--primary)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Priority Breakdown */}
          {analytics?.priority && Object.keys(analytics.priority).length > 0 && (
            <div className="p-4 rounded-md border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Phân bổ theo mức độ ưu tiên</span>
                <span className="text-10 text-muted-foreground font-mono">Priority breakdown</span>
              </div>
              <div className="space-y-2 pt-1">
                {Object.entries(analytics.priority).map(([prio, count]) => {
                  const pct = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
                  return (
                    <div key={prio} className="space-y-1">
                      <div className="flex justify-between text-11 text-muted-foreground">
                        <span className="capitalize">{prio}</span>
                        <span className="font-mono">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Workload by Member */}
          <div className="p-4 rounded-md border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Phân công công việc</span>
              <Users className="size-3.5 text-muted-foreground shrink-0" />
            </div>
            {isLoading ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-6 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-28 rounded" />
                    <Skeleton className="h-2 w-full rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="size-6 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-36 rounded" />
                    <Skeleton className="h-2 w-3/4 rounded" />
                  </div>
                </div>
              </div>
            ) : analytics?.assignee && analytics.assignee.length > 0 ? (
              <div className="space-y-3 pt-1">
                {analytics.assignee.map((a) => {
                  const aPct = totalItems > 0 ? Math.round((a.count / totalItems) * 100) : 0;
                  return (
                    <div key={a.userId} className="flex items-center gap-2.5">
                      <Avatar className="size-6 text-10">
                        {a.avatar && <AvatarImage src={a.avatar} alt={a.name} />}
                        <AvatarFallback>{a.name?.slice(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between text-11">
                          <span className="truncate text-foreground font-medium">{a.name}</span>
                          <span className="text-muted-foreground font-mono">{a.count} ({aPct}%)</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/80 rounded-full"
                            style={{ width: `${aPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-2 text-center">
                Chưa có dữ liệu phân công công việc.
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default AnalyticsDrawer;

