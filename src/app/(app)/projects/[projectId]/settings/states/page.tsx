import type { Metadata } from 'next';
import StatePage from '@/features/projects/project-id/settings/pages/StatePage';

export const metadata: Metadata = { title: 'States · Project Settings' };

export default function Page() {
  return <StatePage />;
}
