import type { Metadata } from 'next';
import MemberPage from '@/features/projects/project-id/settings/pages/MemberPage';

export const metadata: Metadata = { title: 'Members · Project Settings' };

export default function Page() {
  return <MemberPage />;
}
