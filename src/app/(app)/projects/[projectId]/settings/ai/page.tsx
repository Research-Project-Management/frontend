import type { Metadata } from 'next';
import AiPage from '@/features/workspaces/projects/project-id/settings/pages/AiPage';

export const metadata: Metadata = { title: 'AI · Project Settings · Flux' };

export default function ProjectAiSettingsPage() {
  return <AiPage />;
}