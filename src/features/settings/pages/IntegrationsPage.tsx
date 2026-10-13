'use client';

import React, { Suspense } from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { IntegrationsHub } from '../components/integrations/IntegrationsHub';

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48 rounded-md" />
          <Skeleton className="h-4 w-72 rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <Skeleton className="h-36 rounded-lg" />
            <Skeleton className="h-36 rounded-lg" />
          </div>
        </div>
      }
    >
      <IntegrationsHub />
    </Suspense>
  );
}
