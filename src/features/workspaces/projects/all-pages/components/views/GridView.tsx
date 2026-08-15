import React from 'react';
import { Card } from '../card/Card';

interface GridViewProps {
  pages: any[];
  workspaceId: string;
}

export function GridView({ pages, workspaceId }: GridViewProps) {
  return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {pages.map((page: any) => (
        <Card key={page._id} page={page} workspaceId={workspaceId} />
      ))}
    </div>
  );
}

