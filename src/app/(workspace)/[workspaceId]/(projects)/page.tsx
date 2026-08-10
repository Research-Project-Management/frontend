import type { Metadata } from 'next';
import { HomePage } from '@/features/workspaces';

export const metadata: Metadata = {
  title: 'Home · Flux',
};

export default function WorkspaceHomePage() {
  return <HomePage />;
}
