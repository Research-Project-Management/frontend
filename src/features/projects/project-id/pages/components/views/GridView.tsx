'use client';

import React from 'react';
import type { Page } from '../../types/page.types';
import { Card } from '../card/Card';

interface GridViewProps {
  pages: Page[];
}

export function GridView({ pages }: GridViewProps) {
  return (
    <div className="p-4 sm:p-6 pb-12 sm:pb-16 w-full max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4.5">
        {pages.map((page) => (
          <Card key={page.id} page={page} />
        ))}
      </div>
    </div>
  );
}

export default GridView;
