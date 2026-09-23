'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, RefreshCw, FileText, ArrowLeft } from 'lucide-react';
import { logger } from '@/shared/lib/logger';

export default function LibraryRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Library route error captured', error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex-1 w-full h-full min-h-[400px] flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-md border border-border bg-background p-6 text-center space-y-4 shadow-2xs">
        <div className="size-9 rounded-md border border-border bg-muted/40 text-foreground/80 flex items-center justify-center mx-auto shrink-0">
          <BookOpen className="size-4 shrink-0" strokeWidth={1.5} />
        </div>

        <div className="space-y-1">
          <h3 className="text-14 font-medium text-foreground tracking-tight">
            Library Unavailable
          </h3>
          <p className="text-12 text-muted-foreground leading-normal max-w-sm mx-auto">
            The reference service encountered an issue loading your library data.
          </p>
        </div>

        {error.message && (
          <div className="p-2.5 rounded-md bg-muted/50 text-left font-mono text-11 text-muted-foreground overflow-x-auto max-h-24 border border-border/70">
            {error.message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-1.5 h-7 px-3 text-12 font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors cursor-pointer shadow-none"
          >
            <RefreshCw className="size-3 shrink-0" strokeWidth={1.5} />
            <span>Retry</span>
          </button>
          <Link
            href="/projects"
            className="inline-flex items-center justify-center gap-1.5 h-7 px-3 text-12 font-medium text-foreground bg-background hover:bg-muted rounded-md border border-border transition-colors cursor-pointer shadow-2xs"
          >
            <FileText className="size-3 shrink-0" strokeWidth={1.5} />
            <span>Projects</span>
          </Link>
          <Link
            href="/home"
            className="inline-flex items-center justify-center gap-1.5 h-7 px-3 text-12 font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3 shrink-0" strokeWidth={1.5} />
            <span>Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
