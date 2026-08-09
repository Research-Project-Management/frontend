import type { Metadata } from 'next';
import { GeneralSettings } from '@/features/workspaces';

export const metadata: Metadata = { title: 'Project Settings · Flux' };

export default function ProjectSettingsPage() {
  return <GeneralSettings />;
}
