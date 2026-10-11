'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { PageLayout, PageContent } from '@/shared/components/layout/PageLayout';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import SecurityTab from '../components/security/SecurityTab';

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
