import React, { Suspense } from 'react';
import { IntegrationsHub } from '@/features/integrations/components/IntegrationsHub';

export const metadata = {
  title: 'Integrations & Connected Apps | Flux',
  description: 'Manage third-party integrations with Zotero, Mendeley, ORCID, and GitHub.',
};

export default function IntegrationsSettingsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationsHub />
    </Suspense>
  );
}
