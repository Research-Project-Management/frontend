'use client';

import React from 'react';
import { Button } from '@/shared/components/ui';

interface DangerZoneProps {
  onDeleteClick: () => void;
}

export function DangerZone({ onDeleteClick }: DangerZoneProps) {
  return (
    <div className="rounded-lg border border-destructive/30 p-6">
      <div className="flex items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            Delete this workspace
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            This action is irreversible. All data, projects, pages, and member
            access will be permanently removed.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={onDeleteClick}
          className="shrink-0 transition-colors hover:bg-red-700 cursor-pointer"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

export default DangerZone;
