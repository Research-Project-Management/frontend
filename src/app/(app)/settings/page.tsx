import type { Metadata } from 'next';
import GeneralPage from '@/features/workspaces/settings/pages/GeneralPage';

export const metadata: Metadata = { title: 'Settings · Flux' };

export default function WorkspaceSettingsPage() {
  return <GeneralPage />;
}
