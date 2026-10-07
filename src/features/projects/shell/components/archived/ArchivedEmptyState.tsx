'use client';

import React from 'react';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';

export function ArchivedEmptyState() {
  return (
    <div className="h-full min-h-[340px] flex items-center justify-center">
      <PlaneEmptyState
        variant="files"
        title="No archived projects yet"
        description="Archived projects move out of the active projects list but aren't deleted. You'll find them here."
      />
    </div>
  );
}

export default ArchivedEmptyState;
