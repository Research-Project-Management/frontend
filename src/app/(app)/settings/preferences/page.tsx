import type { Metadata } from 'next';
import PreferencesPage from '@/features/workspaces/settings/pages/PreferencesPage';

export const metadata: Metadata = { title: 'Preferences · Flux' };

export default function Page() {
  return <PreferencesPage />;
}
