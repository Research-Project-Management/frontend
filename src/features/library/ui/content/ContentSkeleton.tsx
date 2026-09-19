import React from 'react';
import { Skeleton } from '@/shared/components/ui';

export function ContentSkeleton({ rowCount = 8 }: { rowCount?: number }) {
  return (
    <div className="w-full p-4 space-y-3">
      {/* Table Header skeleton */}
      <div className="flex items-center gap-4 pb-2 border-b border-border/50">
        <Skeleton className="h-4 w-6 rounded" />
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="h-4 w-1/4 rounded" />
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-4 w-1/6 rounded" />
      </div>

      {/* Rows skeleton */}
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2 border-b border-border/30">
          <Skeleton className="h-4 w-6 rounded" />
          <Skeleton className="h-5 w-1/3 rounded" />
          <Skeleton className="h-4 w-1/4 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-4 w-1/6 rounded" />
        </div>
      ))}
    </div>
  );
}
