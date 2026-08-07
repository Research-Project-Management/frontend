import type { Metadata } from 'next';
import { ModelSettings } from '@/features/projects';

export const metadata: Metadata = { title: 'Model Settings · Flux' };

export default function ProjectModelSettingsPage() {
  return <ModelSettings />;
}
