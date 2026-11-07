import type { Metadata } from 'next';
import ProfilePage from '@/features/settings/pages/ProfilePage';

export const metadata: Metadata = { title: 'Settings · Flux' };

export default function SettingsPage() {
  return <ProfilePage />;
}
