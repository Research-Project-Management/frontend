import type { Metadata } from 'next';
import { ExperimentsPage } from '@/features/experiments/pages/ExperimentsPage';

export const metadata: Metadata = { title: 'Experiments' };

export default function ExperimentsIndexPage() {
  return <ExperimentsPage />;
}
