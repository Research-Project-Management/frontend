"use client";

import React from "react";
import { cn } from "@/shared/lib/utils";

export function DocumentPageSkeleton({
  width,
  height,
  animated = true,
}: {
  width?: number;
  height?: number;
  animated?: boolean;
}) {
  const w = width || 600;
  const h = height ? Math.round(height) : Math.round(w * 1.414);
  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-8 bg-background select-none mx-auto",
        animated && "animate-pulse",
      )}
      style={{ width: w, height: h }}
      aria-hidden="true"
    >
      <div className="h-4 w-3/4 bg-muted rounded-sm mb-4" />
      <div className="h-2.5 w-1/2 bg-muted rounded-sm mb-6" />
      <div className="space-y-2.5 flex-1">
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-11/12 bg-muted rounded-sm" />
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-4/5 bg-muted rounded-sm" />
        <div className="h-2 w-full bg-muted rounded-sm mt-4" />
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-9/12 bg-muted rounded-sm" />
      </div>
      <div className="h-2 w-1/4 bg-muted rounded-sm self-center mt-auto" />
    </div>
  );
}
