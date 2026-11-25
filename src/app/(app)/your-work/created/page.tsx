import type { Metadata } from 'next';
import CreatedPage from '@/features/projects/your-work/pages/CreatedPage';

export const metadata: Metadata = { title: 'Created · Your Work' };

export default function Page() {
  return <CreatedPage />;
}
