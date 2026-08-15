import React from 'react';
import type { Page } from '../../types/page.types';
import { Card } from '../card/Card';

interface GridViewProps {
  pages: Page[];
  workspaceId: string;
}

export function GridView({ pages, workspaceId }: GridViewProps) {
  return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {pages.map((page) => (
        <Card key={page._id} page={page} workspaceId={workspaceId} />
      ))}
    </div>
  );
}
