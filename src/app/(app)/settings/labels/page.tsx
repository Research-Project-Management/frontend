import type { Metadata } from 'next';
import LabelsPage from '@/features/settings/pages/LabelsPage';

export const metadata: Metadata = { title: 'Labels · Settings' };

export default function LabelsRoute() {
  return <LabelsPage />;
}
