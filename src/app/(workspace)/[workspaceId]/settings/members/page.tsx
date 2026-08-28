import type { Metadata } from 'next';
import MemberPage from '@/features/workspaces/settings/pages/MemberPage';

export const metadata: Metadata = { title: 'Members · Settings · Flux' };

export default function WorkspaceMembersPage() {
  return <MemberPage />;
}
