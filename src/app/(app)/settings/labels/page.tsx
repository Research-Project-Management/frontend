import type { Metadata } from 'next';
import LabelsPage from '@/features/workspaces/settings/pages/LabelsPage';

export const metadata: Metadata = { title: 'Labels · Settings · Flux' };

export default function LabelsRoute() {
  return <LabelsPage />;
}
