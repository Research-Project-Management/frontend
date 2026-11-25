import type { Metadata } from 'next';
import ActivityPage from '@/features/projects/your-work/pages/ActivityPage';

export const metadata: Metadata = { title: 'Activity · Your Work' };

export default function Page() {
  return <ActivityPage />;
}
