import type { Metadata } from 'next';
import SummaryPage from '@/features/projects/your-work/pages/SummaryPage';

export const metadata: Metadata = { title: 'Your Work' };

export default function Page() {
  return <SummaryPage />;
}
