import type { Metadata } from 'next';
import { Suspense } from 'react';
import AnalyticsPage from '@/features/analytics/pages/AnalyticsPage';

export const metadata: Metadata = {
  title: 'Analytics · Flux',
  description: 'Research and project performance, work item distributions, and delivery metrics across all projects.',
};

export default function ProjectsAnalyticsRoute() {
  return (
    <Suspense fallback={null}>
      <AnalyticsPage />
    </Suspense>
  );
}
