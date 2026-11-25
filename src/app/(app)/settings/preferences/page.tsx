import type { Metadata } from 'next';
import PreferencesPage from '@/features/settings/pages/PreferencesPage';

export const metadata: Metadata = { title: 'Preferences · Settings' };

export default function Page() {
  return <PreferencesPage />;
}
