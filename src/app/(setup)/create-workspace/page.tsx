import type { Metadata } from 'next';
import CreateWorkspacePage from '@/features/setup/pages/create-workspace-page';

export const metadata: Metadata = {
  title: 'Create Workspace · Flux',
};

export default function Page() {
  return <CreateWorkspacePage />;
}
