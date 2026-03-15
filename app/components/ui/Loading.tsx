import { Skeleton } from "./skeleton";

/**
 * Unified loading component.
 * Renders a full-area skeleton that adapts to its container.
 * Pass variant="inline" for a compact spinner used inside buttons/cards.
 */
export default function Loading({
  variant = "page",
}: {
  variant?: "page" | "inline";
}) {
  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-muted-foreground">
          <svg
            className="size-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-6 gap-6 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      {/* Content skeleton — grid of cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 p-4 rounded-lg border border-border">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-20 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
