import { Skeleton } from "./skeleton";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

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
      <div className="flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.15 }}
            className="text-xs text-muted-foreground font-medium uppercase tracking-wider"
          >
            Loading
          </motion.span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-6 gap-8 animate-in fade-in zoom-in-95 duration-200 ease-out-expo">
      {/* Header skeleton with logo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64 opacity-60" />
          </div>
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      {/* Content skeleton — grid of modern cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="space-y-4 p-5 rounded-2xl border border-border bg-card/30 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2 opacity-60" />
              </div>
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
