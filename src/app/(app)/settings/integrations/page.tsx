import type { Metadata } from 'next';
import IntegrationsPage from '@/features/settings/pages/IntegrationsPage';

export const metadata: Metadata = {
  title: 'Integrations & Connected Apps · Flux',
  description: 'Manage third-party integrations with Zotero, Mendeley, ORCID, and GitHub.',
};

export default function IntegrationsSettingsPage() {
  return <IntegrationsPage />;
}
