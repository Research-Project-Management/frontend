import type { Metadata } from 'next';
import AiSettingsPage from '@/features/settings/pages/AiSettingsPage';

export const metadata: Metadata = { title: 'AI Assistant · Flux' };

export default function Page() {
  return <AiSettingsPage />;
}
