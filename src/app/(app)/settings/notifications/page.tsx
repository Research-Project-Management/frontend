import type { Metadata } from 'next';
import NotificationsPage from '@/features/settings/pages/NotificationsPage';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Notifications · Flux' };

export default function Page() {
  return <NotificationsPage />;
}
