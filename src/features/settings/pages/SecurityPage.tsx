'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { PageLayout, PageHeader, PageContent } from '@/shared/components/layout';
import SecurityTab from '@/features/account/components/SecurityTab';

export default function SecurityPage() {
  return (
    <PageLayout>
      <PageHeader
        title="Security"
        icon={Lock}
      />
      <PageContent maxWidth="full" noPadding>
        <SecurityTab />
      </PageContent>
    </PageLayout>
  );
}
