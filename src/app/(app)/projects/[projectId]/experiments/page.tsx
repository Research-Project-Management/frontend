import type { Metadata } from 'next';
import ExperimentsPage from '@/features/experiments/pages/ExperimentsPage';

export const metadata: Metadata = {
  title: 'Experiments',
  description: 'Project experiment tracking, model benchmarks, and dataset management',
};

export default function ProjectExperimentsRoute() {
  return <ExperimentsPage />;
}
