'use client';

import React from 'react';
import type { Task, Column } from '../../types/types';
import type { AssigneeFilterOption } from '../../hooks/use-topbar';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Skeleton,
  Badge,
} from '@/shared/components/ui';
import { BarChart3, TrendingUp, Users, CheckCircle2 } from 'lucide-react';

export interface AnalyticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project?: any;
  tasks?: Task[];
  columns?: Column[];
  assignees?: AssigneeFilterOption[];
  [key: string]: any;
}

export function AnalyticsDrawer({
  isOpen,
  onClose,
  tasks = [],
  columns = [],
}: AnalyticsDrawerProps) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (t) => t.completed || t.columnId === 'done'
  ).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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
            <Badge variant="outline" className="text-10 font-normal px-1.5 py-0 h-4 text-muted-foreground border-border">
              Dựng khung / Preview
            </Badge>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Hiệu suất và tổng quan tiến độ các công việc trong dự án.
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
                {totalTasks}
              </div>
              <p className="text-10 text-muted-foreground">Toàn bộ work items</p>
            </div>

            <div className="p-3 rounded-md border border-border bg-card space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Completion</span>
                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
              </div>
              <div className="text-xl font-semibold text-foreground font-mono">
                {completionRate}%
              </div>
              <p className="text-10 text-muted-foreground">{completedTasks}/{totalTasks} hoàn thành</p>
            </div>
          </div>

          {/* Skeleton Chart Frame 1: Status Breakdown */}
          <div className="p-4 rounded-md border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Phân bổ theo trạng thái</span>
              <span className="text-10 text-muted-foreground font-mono">Workflow distribution</span>
            </div>
            <div className="space-y-2 pt-1">
              {columns.slice(0, 4).map((col) => (
                <div key={col.id} className="space-y-1">
                  <div className="flex justify-between text-11 text-muted-foreground">
                    <span>{col.title || col.name}</span>
                    <span className="font-mono">
                      {tasks.filter((t) => t.columnId === col.id).length}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${
                          totalTasks > 0
                            ? (tasks.filter((t) => t.columnId === col.id).length / totalTasks) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skeleton Chart Frame 2: Velocity & Timeline */}
          <div className="p-4 rounded-md border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Tốc độ hoàn thành (Velocity)</span>
              <TrendingUp className="size-3.5 text-muted-foreground shrink-0" />
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-24 w-full rounded border border-dashed border-border flex items-center justify-center bg-muted/20">
                <span className="text-11 text-muted-foreground">Khung biểu đồ tiến độ đang dựng</span>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-4 flex-1 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            </div>
          </div>

          {/* Skeleton Chart Frame 3: Workload by Member */}
          <div className="p-4 rounded-md border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Phân công công việc</span>
              <Users className="size-3.5 text-muted-foreground shrink-0" />
            </div>
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
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default AnalyticsDrawer;
