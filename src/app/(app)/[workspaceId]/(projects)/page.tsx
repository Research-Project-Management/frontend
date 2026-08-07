import type { Metadata } from 'next';
import { HomeDashboard } from '@/features/projects';

export const metadata: Metadata = {
  title: 'Home · Flux',
};

export default function WorkspaceHomePage() {
  return <HomeDashboard />;
}
