import type { Metadata } from 'next';
import { HomePage } from '@/features/workspaces/projects/home';

export const metadata: Metadata = {
  title: 'Home · Flux',
};

export default function WorkspaceHomePage() {
  return <HomePage />;
}
