'use client';

import React, { memo } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import type { CitationValidationDto } from '@/features/editor/services/manuscript.service';

interface CitationValidationBannerProps {
  validation: CitationValidationDto | null | undefined;
  onSelectKey?: (key: string) => void;
}

export const CitationValidationBanner = memo(function CitationValidationBanner({
  validation,
  onSelectKey,
}: CitationValidationBannerProps) {
  if (!validation) return null;

  const hasDuplicates = validation.duplicateKeys && validation.duplicateKeys.length > 0;
  const hasMissingFields =
    validation.missingFieldWarnings && validation.missingFieldWarnings.length > 0;

  if (!hasDuplicates && !hasMissingFields) return null;

  return (
    <div className="space-y-2 mb-2">
      {/* Duplicate Citation Keys Warning */}
      {hasDuplicates && (
        <div className="p-2.5 rounded-md bg-warning/10 border border-warning/25 text-foreground text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-warning">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>Duplicate Keys ({validation.duplicateKeys.length})</span>
          </div>
          <p className="text-11 leading-normal text-muted-foreground">
            Duplicate keys across your .bib files can cause ambiguous references in LaTeX. Click a key below to filter and resolve:
          </p>
          <div className="flex flex-wrap gap-1 pt-0.5">
            {validation.duplicateKeys.map((k: string) => (
              <button
                key={k}
                type="button"
                onClick={() => onSelectKey?.(k)}
                className="px-1.5 py-0.5 font-mono text-10 font-medium rounded bg-warning/15 text-foreground hover:bg-warning/25 transition-colors cursor-pointer border border-warning/20 outline-none focus-visible:ring-1 focus-visible:ring-primary"
                title={`Click to filter by ${k}`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Missing Required Metadata Fields Advisory */}
      {hasMissingFields && (
        <div className="p-2.5 rounded-md bg-muted/50 border border-border/60 text-foreground text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <AlertCircle className="size-3.5 shrink-0 text-muted-foreground" />
            <span>Incomplete Metadata ({validation.missingFieldWarnings.length})</span>
          </div>
          <div className="space-y-0.5 text-11 text-muted-foreground max-h-24 overflow-y-auto pr-1">
            {validation.missingFieldWarnings.map((w: { key: string; missingFields: string[] }) => (
              <div key={w.key} className="truncate">
                <span className="font-mono text-foreground font-medium">{w.key}</span>: missing{' '}
                {w.missingFields.join(', ')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default CitationValidationBanner;
