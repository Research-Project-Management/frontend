import type { Metadata } from 'next';
import LabelPage from '@/features/projects/project-id/settings/pages/LabelPage';

export const metadata: Metadata = { title: 'Labels · Project Settings' };

export default function Page() {
  return <LabelPage />;
}
