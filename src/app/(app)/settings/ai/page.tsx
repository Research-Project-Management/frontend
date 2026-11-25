import type { Metadata } from 'next';
import AiSettingsPage from '@/features/settings/pages/AiSettingsPage';

export const metadata: Metadata = { title: 'AI · Settings' };

export default function Page() {
  return <AiSettingsPage />;
}
