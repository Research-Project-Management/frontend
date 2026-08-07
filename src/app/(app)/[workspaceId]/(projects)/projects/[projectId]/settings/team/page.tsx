import type { Metadata } from 'next';
import { TeamSettings } from '@/features/projects';

export const metadata: Metadata = { title: 'Project Team · Flux' };

export default function ProjectTeamSettingsPage() {
  return <TeamSettings />;
}
