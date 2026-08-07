import type { Metadata } from 'next';
import GeneralPage from '@/features/settings/components/general';

export const metadata: Metadata = { title: 'Settings Â· Flux' };

export default function WorkspaceSettingsPage() {
  return <GeneralPage />;
}
