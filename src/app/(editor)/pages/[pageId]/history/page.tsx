import type { Metadata } from 'next';
import HistoryPage from '@/features/editor/subsystems/history/ui/HistoryPage';

export const metadata: Metadata = { title: 'Version History — Flux' };

export default function PersonalPageHistoryRoute() {
  return <HistoryPage />;
}
