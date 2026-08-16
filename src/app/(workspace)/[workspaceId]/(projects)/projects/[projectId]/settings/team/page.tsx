import type { Metadata } from 'next';
import MemberPage from '@/features/workspaces/projects/project-id/settings/pages/MemberPage';

export const metadata: Metadata = { title: 'Project Members · Flux' };

export default function ProjectTeamSettingsPage() {
  return <MemberPage />;
}
