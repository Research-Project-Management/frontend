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
      <div className="max-w-lg w-full rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/10 p-6 text-center space-y-4 shadow-xs">
        <div className="size-12 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shrink-0">
          <BookOpen className="size-6 shrink-0" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-foreground">
            Library Module Temporarily Unavailable
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The reference management service (Library) is experiencing connection issues or backend downtime.
            <br />
            <strong className="text-foreground/90 font-medium">Note:</strong> Other modules such as{' '}
            <span className="text-primary font-medium">Document Editor</span>,{' '}
            <span className="text-primary font-medium">Projects</span>, and{' '}
            <span className="text-primary font-medium">AI Assistant</span> remain fully functional.
          </p>
        </div>

        {error.message && (
          <div className="p-2.5 rounded-md bg-muted text-left font-mono text-xs text-muted-foreground overflow-x-auto max-h-24 border border-border/50">
            {error.message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5 shrink-0" />
            Retry Connection
          </button>
          <Link
            href="/projects"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-foreground bg-background hover:bg-muted rounded-md border border-border transition-colors cursor-pointer"
          >
            <FileText className="size-3.5 shrink-0" />
            Go to Projects / Document
          </Link>
          <Link
            href="/home"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5 shrink-0" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
