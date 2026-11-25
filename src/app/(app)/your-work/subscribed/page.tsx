import type { Metadata } from 'next';
import SubscribedPage from '@/features/projects/your-work/pages/SubscribedPage';

export const metadata: Metadata = { title: 'Subscribed · Your Work' };

export default function Page() {
  return <SubscribedPage />;
}
