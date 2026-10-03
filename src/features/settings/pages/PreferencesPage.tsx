'use client';

import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { PageLayout, PageHeader, PageContent } from '@/shared/components/layout';
import PreferencesTab from '@/features/account/components/PreferencesTab';

export default function PreferencesPage() {
  return (
    <PageLayout>
      <PageHeader
        title="Preferences"
        icon={SlidersHorizontal}
      />
      <PageContent maxWidth="full" noPadding>
        <PreferencesTab />
      </PageContent>
    </PageLayout>
  );
}
