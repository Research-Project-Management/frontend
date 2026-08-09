import type { Metadata } from 'next';
import { ModulesSettings } from '@/features/workspaces';

export const metadata: Metadata = { title: 'Project Modules · Flux' };

export default function ProjectModulesSettingsPage() {
  return <ModulesSettings />;
}
