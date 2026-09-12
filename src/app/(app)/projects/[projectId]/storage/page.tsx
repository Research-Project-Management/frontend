import type { Metadata } from 'next';
import HomePage from '@/features/workspaces/projects/project-id/storage/pages/HomePage';

export const metadata: Metadata = { title: 'Storage · Flux' };

export default function ProjectHomePage() {
  return <HomePage />;
}
