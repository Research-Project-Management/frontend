import type { Metadata } from 'next';
import TeamPage from '@/features/workspaces/projects/project-id/settings/pages/TeamPage';

export const metadata: Metadata = { title: 'Project Team · Flux' };

export default function ProjectTeamSettingsPage() {
  return <TeamPage />;
}
