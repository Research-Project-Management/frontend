import type { Metadata } from 'next';
import { HistoryPage } from '@/features/editor/subsystems/history';

export const metadata: Metadata = { title: 'History' };

export default function PageHistoryRoute() {
  return <HistoryPage />;
}
