import type { Metadata } from 'next';
import { Suspense } from 'react';
import AnalyticsPage from '@/features/projects/analytics/pages/AnalyticsPage';

export const metadata: Metadata = {
  title: 'Analytics · Flux',
  description: 'Workspace and project analytics dashboard.',
};

export default function AnalyticsRoute() {
  return (
    <Suspense fallback={null}>
      <AnalyticsPage />
    </Suspense>
  );
}
