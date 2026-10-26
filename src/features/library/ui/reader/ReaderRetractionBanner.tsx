'use client';

import React from 'react';
import { ShieldAlert, ExternalLink } from 'lucide-react';
import { safeHttpUrl } from '@/features/library/domain/retraction';
import type { Item, RetractionDetails } from '@/features/library/domain/types/library.types';

export interface ReaderRetractionBannerProps {
  paper?: {
    isRetracted?: boolean;
    retractionNature?: string;
    [key: string]: unknown;
  } | null;
  retractionDetails?: {
    reason?: string;
    noticeUrl?: string;
    [key: string]: unknown;
  } | null;
}

export function ReaderRetractionBanner({ paper, retractionDetails }: ReaderRetractionBannerProps) {
  if (!paper?.isRetracted) return null;

  return (
    <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between text-12 z-30 shrink-0 border-b border-destructive/20 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="size-4 shrink-0 text-destructive-foreground" />
        <span className="font-semibold tracking-normal">
          {paper.retractionNature === 'expression_of_concern'
            ? 'Expression of Concern'
            : paper.retractionNature === 'correction'
              ? 'Publisher Correction'
              : 'Retracted Publication'}
        </span>
        <span className="text-destructive-foreground/90 truncate max-w-xl">
          - {retractionDetails?.reason || 'This publication has been flagged as retracted or unreliable.'}
        </span>
      </div>
      {safeHttpUrl(retractionDetails?.noticeUrl) && (
        <a
          href={safeHttpUrl(retractionDetails?.noticeUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-12 text-destructive-foreground underline font-medium hover:text-destructive-foreground/80 shrink-0 ml-4 relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Notice <ExternalLink className="size-3 shrink-0" />
        </a>
      )}
    </div>
  );
}

export default ReaderRetractionBanner;
