import type { Metadata } from 'next';
import { Create } from '@/features/workspaces';

export const metadata: Metadata = {
  title: 'Create Workspace · Flux',
};

export default function CreateWorkspacePage() {
  return <Create />;
}
