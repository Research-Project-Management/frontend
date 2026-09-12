import type { Metadata } from 'next';
import ExportPage from '@/features/workspaces/projects/project-id/settings/pages/ExportPage';

export const metadata: Metadata = { title: 'Export · Project Settings · Flux' };

export default function ProjectExportSettingsPage() {
  return <ExportPage />;
}