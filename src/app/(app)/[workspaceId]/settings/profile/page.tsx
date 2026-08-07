import type { Metadata } from 'next';
import ProfilePage from '@/features/profile/components/ProfilePage';

export const metadata: Metadata = { title: 'Profile Â· Flux' };

export default function WorkspaceProfilePage() {
  return <ProfilePage />;
}
