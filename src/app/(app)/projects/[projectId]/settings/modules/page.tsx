import type { Metadata } from 'next';
import ProjectModulesPage from '@/features/projects/project-id/settings/pages/ModulesPage';

export const metadata: Metadata = { title: 'Modules · Project Settings' };

export default function Page() { return <ProjectModulesPage />; }
