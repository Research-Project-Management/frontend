import type { Metadata } from 'next';
import { HomeDashboard } from '@/features/workspaces';

export const metadata: Metadata = {
  title: 'Home · Flux',
};

export default function WorkspaceHomePage() {
  return <HomeDashboard />;
}
