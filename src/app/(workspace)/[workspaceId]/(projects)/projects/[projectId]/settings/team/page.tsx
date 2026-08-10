import type { Metadata } from 'next';
import { TeamPage } from '@/features/workspaces';

export const metadata: Metadata = { title: 'Project Team · Flux' };

export default function ProjectTeamSettingsPage() {
  return <TeamPage />;
}
