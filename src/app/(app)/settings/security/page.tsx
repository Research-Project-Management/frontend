import type { Metadata } from 'next';
import SecurityPage from '@/features/workspaces/settings/pages/SecurityPage';

export const metadata: Metadata = { title: 'Security · Flux' };

export default function Page() {
  return <SecurityPage />;
}
