import type { Metadata } from 'next';
import ProjectGeneralPage from '@/features/projects/project-id/settings/pages/GeneralPage';

export const metadata: Metadata = { title: 'General · Project Settings' };

export default function Page() {
  return <ProjectGeneralPage />;
}
