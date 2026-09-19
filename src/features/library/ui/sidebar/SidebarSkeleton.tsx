import React from 'react';
import { Skeleton } from '@/shared/components/ui';

export function SidebarSkeleton() {
  return (
    <div className="h-full w-full p-3 space-y-4 bg-muted/20 animate-pulse">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="space-y-2 pt-2">
        <Skeleton className="h-7 w-full rounded" />
        <Skeleton className="h-7 w-full rounded" />
        <Skeleton className="h-7 w-full rounded" />
        <Skeleton className="h-7 w-full rounded" />
      </div>

      <div className="pt-4 space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-full rounded" />
        <Skeleton className="h-6 w-full rounded" />
      </div>
    </div>
  );
}
