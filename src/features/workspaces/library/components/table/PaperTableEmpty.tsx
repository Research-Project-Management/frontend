'use client';

import React from 'react';
import { FileStack, Search } from 'lucide-react';
import { Button } from '@/shared/components/ui';

interface PaperTableEmptyProps {
  isSearch: boolean;
  onClearSearch?: () => void;
  collectionName?: string;
}

export default function PaperTableEmpty({
  isSearch,
  onClearSearch,
  collectionName,
}: PaperTableEmptyProps) {
  if (isSearch) {
    return (
      <div className="flex flex-col items-center justify-center gap-2.5 py-24 text-center px-6 select-none max-w-sm mx-auto">
        <Search className="size-14 sm:size-16 stroke-[1.15] text-muted-foreground/35 mb-1" />
        <div className="space-y-1.5">
          <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
            No matching papers
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-[280px]">
            No documents found matching your search query or active filters.
          </p>
        </div>
        {onClearSearch && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSearch}
            className="h-8 px-3 text-xs font-medium mt-1 cursor-pointer"
          >
            Clear search
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-24 text-center px-6 select-none max-w-sm mx-auto">
      <FileStack className="size-14 sm:size-16 stroke-[1.15] text-muted-foreground/35 mb-1" />
      <div className="space-y-1.5">
        <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
          {collectionName ? `No papers in ${collectionName}` : 'No papers in library'}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-[290px]">
          {collectionName
            ? 'Drag and drop PDF files here to upload directly to this collection.'
            : 'Drag and drop PDF files anywhere on this page, or use the topbar to import documents.'}
        </p>
      </div>
    </div>
  );
}
