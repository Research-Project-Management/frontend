'use client';

import React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Cloud, Crown, Info, AlertTriangle } from 'lucide-react';
import { Progress } from "@/shared/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Badge } from "@/shared/components/ui/badge";
import { useStorageQuota } from '../../hooks/use-storage-quota';
import { cn } from "@/shared/lib/utils";
import Link from 'next/link';

export interface StorageQuotaWidgetProps {
  projectId?: string;
  className?: string;
  compact?: boolean;
}

export function StorageQuotaWidget({
  projectId: propProjectId,
  className,
  compact = false,
}: StorageQuotaWidgetProps) {
  const params = useParams();
  const searchParams = useSearchParams();

  // Resolve projectId from prop, route params (/projects/[projectId]/...), or query param (?projectId=...)
  const routeProjectId = params?.projectId as string | undefined;
  const queryProjectId = searchParams?.get('projectId') || undefined;
  const effectiveProjectId = propProjectId || routeProjectId || queryProjectId;

  const {
    quota,
    isLoading,
    isProjectScope,
    ownerName,
    usedFormatted,
    projectFormatted,
    limitFormatted,
    percentage,
  } = useStorageQuota({ projectId: effectiveProjectId });

  if (isLoading && !quota) {
    return (
      <div className={cn('p-3 rounded-lg border border-border/60 bg-card/60 animate-pulse space-y-2', className)}>
        <div className="h-3 w-24 bg-muted rounded" />
        <div className="h-2 w-full bg-muted rounded" />
        <div className="h-2.5 w-16 bg-muted rounded" />
      </div>
    );
  }

  const isWarning = percentage >= 80 && percentage < 95;
  const isDanger = percentage >= 95;

  const progressColorClass = isDanger
    ? '[&_[data-slot=progress-indicator]]:bg-destructive'
    : isWarning
      ? '[&_[data-slot=progress-indicator]]:bg-amber-500'
      : '[&_[data-slot=progress-indicator]]:bg-primary';

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Link
              href={effectiveProjectId ? `/storage?projectId=${encodeURIComponent(effectiveProjectId)}` : '/storage'}
              className={cn(
                'flex flex-col items-center justify-center p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors group relative select-none',
                className
              )}
              aria-label="Storage Quota"
            >
              <div className="relative flex items-center justify-center">
                <Cloud className="size-5 transition-colors group-hover:text-foreground" />
                {isProjectScope && (
                  <span className="absolute -top-1 -right-1 flex size-2 rounded-full bg-primary ring-1 ring-background" />
                )}
              </div>
              <span className="text-10 font-medium tracking-tight mt-0.5 text-muted-foreground group-hover:text-foreground">
                {percentage}%
              </span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs space-y-1.5 p-3">
            <div className="flex items-center gap-1.5 font-medium text-xs">
              <Cloud className="size-3.5 text-primary" />
              <span>{isProjectScope ? 'Project Storage' : 'Personal Storage'}</span>
            </div>
            {isProjectScope && ownerName && (
              <p className="text-11 text-muted-foreground flex items-center gap-1">
                <Crown className="size-3 text-amber-500 shrink-0" />
                <span>Owner: <strong>{ownerName}</strong></span>
              </p>
            )}
            <Progress value={percentage} className={cn('h-1.5', progressColorClass)} />
            <div className="flex justify-between text-11 text-muted-foreground pt-0.5">
              <span>{usedFormatted} / {limitFormatted}</span>
              <span>{percentage}%</span>
            </div>
            {isProjectScope && (
              <p className="text-10 text-muted-foreground/80 italic border-t border-border/50 pt-1">
                Usage applied to Project Owner quota
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2 rounded-lg border border-border/70 bg-card/60 p-3 text-card-foreground shadow-xs transition-colors hover:border-border select-none',
        className
      )}
    >
      {/* Header & Scope Badge */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Cloud className="size-4 text-primary shrink-0" />
          <span className="text-xs font-semibold tracking-tight text-foreground truncate">
            {isProjectScope ? 'Project Storage' : 'Personal Storage'}
          </span>
        </div>

        {isProjectScope ? (
          <Badge
            variant="outline"
            className="text-10 px-1.5 py-0 h-4 border-primary/30 bg-primary/10 text-primary font-normal shrink-0"
          >
            Project
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-10 px-1.5 py-0 h-4 border-border text-muted-foreground font-normal shrink-0"
          >
            Personal
          </Badge>
        )}
      </div>

      {/* Project Owner Attribution */}
      {isProjectScope && (
        <div className="flex items-center gap-1 text-11 text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
          <Crown className="size-3 text-amber-500 shrink-0" />
          <span className="truncate">
            Owner: <strong className="text-foreground font-medium">{ownerName || 'Project Lead'}</strong>
          </span>
          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="ml-auto cursor-help text-muted-foreground/70 hover:text-foreground"
                  aria-label="Storage quota information"
                >
                  <Info className="size-3 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                All research project data is counted directly against the Project Owner&apos;s storage quota.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-1">
        <Progress
          value={percentage}
          className={cn('h-1.5 bg-muted', progressColorClass)}
          aria-label={`Storage used ${percentage}%`}
        />

        <div className="flex items-center justify-between text-11 text-muted-foreground">
          <span className="tabular-nums">
            {usedFormatted} <span className="text-muted-foreground/60">/</span> {limitFormatted}
          </span>
          <span className={cn('font-medium tabular-nums', isDanger ? 'text-destructive' : isWarning ? 'text-amber-500' : 'text-foreground')}>
            {percentage}%
          </span>
        </div>
      </div>

      {/* Secondary stat: Project-specific usage if inside project */}
      {isProjectScope && projectFormatted && (
        <div className="text-10 text-muted-foreground/90 flex justify-between border-t border-border/40 pt-1">
          <span>This project:</span>
          <span className="font-medium text-foreground">{projectFormatted}</span>
        </div>
      )}

      {/* Warning Alert if near quota */}
      {isDanger && (
        <div className="flex items-center gap-1 text-11 text-destructive bg-destructive/10 rounded px-1.5 py-0.5 mt-0.5">
          <AlertTriangle className="size-3 shrink-0" />
          <span className="truncate">Storage almost full (&gt;95%)</span>
        </div>
      )}
    </div>
  );
}

export default StorageQuotaWidget;
