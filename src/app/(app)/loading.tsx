import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * Next.js App Router Instant Shell Loading Placeholder.
 * 
 * Performance Benefits (Vercel Guidelines):
 * 1. Instant Navigation: Provides an immediate UI shell response during soft
 *    and hard navigation without blocking on client-side data queries.
 * 2. Cumulative Layout Shift (CLS) Prevention: Matches the exact padding, layout,
 *    and header structure of Flux workspace views.
 */
export default function AppLoading() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Top action header skeleton */}
      <div className="flex h-11 items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-4 w-8 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-44 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      {/* Main body content skeleton */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Secondary filters bar */}
        <div className="flex items-center gap-2 pb-2">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>

        {/* Grid cards placeholder */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <Skeleton className="h-24 w-full rounded-md" />
              <div className="space-y-2 pt-1">
                <Skeleton className="h-4 w-3/4 rounded-sm" />
                <Skeleton className="h-3 w-1/2 rounded-sm" />
                <Skeleton className="h-3 w-2/5 rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
