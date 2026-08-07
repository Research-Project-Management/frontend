import type { Metadata } from 'next';
import { GeneralSettings } from '@/features/projects';

export const metadata: Metadata = { title: 'Project Settings · Flux' };

export default function ProjectSettingsPage() {
  return <GeneralSettings />;
}
