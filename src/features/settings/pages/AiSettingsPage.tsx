'use client';

import React from 'react';
import { KeyRound } from 'lucide-react';
import { PageLayout, PageContent } from '@/shared/components/layout/PageLayout';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import AiByokTab from '../components/ai/AiByokTab';

export default function AiSettingsPage() {
  return (
    <PageLayout>
      <PageHeader
        title="AI Assistant"
        icon={KeyRound}
      />
      <PageContent maxWidth="full" noPadding>
        <AiByokTab />
      </PageContent>
    </PageLayout>
  );
}
