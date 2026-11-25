import type { Metadata } from 'next';
import AssignedPage from '@/features/projects/your-work/pages/AssignedPage';

export const metadata: Metadata = { title: 'Assigned · Your Work' };

export default function Page() {
  return <AssignedPage />;
}
