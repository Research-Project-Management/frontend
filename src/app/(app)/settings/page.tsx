import type { Metadata } from 'next';
import ProfilePage from '@/features/workspaces/settings/pages/ProfilePage';

export const metadata: Metadata = { title: 'Profile · Flux' };

export default function SettingsPage() {
  return <ProfilePage />;
}
