import React from 'react';
import { FileText, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui';

interface EmptyStateProps {
  onCreateClick: () => void;
}

export function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 -mt-10">
      <div className="flex items-center justify-center size-20 rounded-lg bg-muted/40">
        <FileText className="size-8 text-muted-foreground/50" />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <h3 className="font-semibold text-foreground">No documents yet</h3>
        <p className="text-sm text-muted-foreground">Create your first document to get started</p>
      </div>
      <Button
        size="sm"
        className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={onCreateClick}
      >
        <Plus className="mr-2 size-4" />
        Add Document
      </Button>
    </div>
  );
}
