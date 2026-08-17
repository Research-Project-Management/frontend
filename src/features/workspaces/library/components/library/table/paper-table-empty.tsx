'use client';

import React from 'react';
import { FileStack, Search } from 'lucide-react';
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
      <div className="flex flex-col items-center justify-center gap-2.5 py-24 text-center px-6 select-none max-w-sm mx-auto">
        <Search className="size-12 stroke-[1.25] text-muted-foreground/35 mb-1" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground tracking-tight">
            No matching papers
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            No documents found matching your search query or filters.
          </p>
        </div>
        {onClearSearch && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSearch}
            className="h-8 px-3 text-xs font-medium mt-2 cursor-pointer"
          >
            Clear search
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-24 text-center px-6 select-none max-w-sm mx-auto">
      <FileStack className="size-12 stroke-[1.25] text-muted-foreground/35 mb-1" />
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">
          {collectionName ? `No papers in ${collectionName}` : 'No papers in library'}
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Drop PDF files here or add documents to start researching.
        </p>
      </div>
      {onAddPaper && (
        <Button
          size="sm"
          onClick={onAddPaper}
          className="h-8 px-3 text-xs font-medium mt-2 cursor-pointer"
        >
          Add Paper
        </Button>
      )}
    </div>
  );
}
