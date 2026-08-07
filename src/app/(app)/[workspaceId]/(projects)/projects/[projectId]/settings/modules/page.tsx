import type { Metadata } from 'next';
import { ModulesSettings } from '@/features/projects';

export const metadata: Metadata = { title: 'Project Modules · Flux' };

export default function ProjectModulesSettingsPage() {
  return <ModulesSettings />;
}
