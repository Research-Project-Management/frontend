'use client';

import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { PageLayout, PageContent } from '@/shared/components/layout/PageLayout';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import PreferencesTab from '../components/preferences/PreferencesTab';

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
