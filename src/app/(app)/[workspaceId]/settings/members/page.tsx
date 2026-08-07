import type { Metadata } from 'next';
import MemberPage from '@/features/settings/components/member';

export const metadata: Metadata = { title: 'Members Â· Settings Â· Flux' };

export default function WorkspaceMembersPage() {
  return <MemberPage />;
}
