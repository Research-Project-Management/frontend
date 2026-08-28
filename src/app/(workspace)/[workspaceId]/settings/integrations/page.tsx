import type { Metadata } from 'next';
import IntegrationsPage from '@/features/workspaces/settings/pages/IntegrationsPage';

export const metadata: Metadata = { title: 'Integrations · Flux' };

export default function WorkspaceIntegrationsPage() {
  return <IntegrationsPage />;
}
