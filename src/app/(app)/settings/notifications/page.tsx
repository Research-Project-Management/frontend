import type { Metadata } from 'next';
import NotificationsPage from '@/features/settings/pages/NotificationsPage';

export const metadata: Metadata = { title: 'Notifications · Flux' };

export default function Page() {
  return <NotificationsPage />;
}
