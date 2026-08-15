'use client';

import React from 'react';
import { BookOpen, SearchX, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/shared/components/ui';

interface PaperTableEmptyProps {
  isSearch: boolean;
  onClearSearch?: () => void;
  onAddPaper?: () => void;
  collectionName?: string;
}

export default function PaperTableEmpty({
  isSearch,
  onClearSearch,
  onAddPaper,
  collectionName,
}: PaperTableEmptyProps) {
  if (isSearch) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-28 text-center px-6 select-none max-w-md mx-auto">
        <div className="size-16 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground shadow-xs border border-border/40">
          <SearchX className="size-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground tracking-tight">
            No matching papers found
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Try adjusting your search query, filtering by authors, or searching across all collections.
          </p>
        </div>
        {onClearSearch && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSearch}
            className="h-9 px-4 text-sm font-medium mt-1"
          >
            Clear Search
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-28 text-center px-6 select-none max-w-md mx-auto">
      <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs border border-primary/20">
        <BookOpen className="size-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground tracking-tight">
          {collectionName ? `No papers in "${collectionName}"` : 'Your library is empty'}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {collectionName
            ? 'Add research papers to this collection or drag references from My Library.'
            : 'Start building your research reference database by adding papers, importing via DOI/arXiv, or uploading PDF files.'}
        </p>
      </div>
      {onAddPaper && (
        <Button
          onClick={onAddPaper}
          className="h-9 px-5 text-sm font-medium gap-2 shadow-sm mt-1"
        >
          <Plus className="size-4" />
          Add Paper
        </Button>
      )}
    </div>
  );
}
