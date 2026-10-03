'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { PageLayout, PageHeader, PageContent } from '@/shared/components/layout';
import NotificationsTab from '@/features/account/components/NotificationsTab';

export default function NotificationsPage() {
  return (
    <PageLayout>
      <PageHeader
        title="Notifications"
        icon={Bell}
      />
      <PageContent maxWidth="full" noPadding>
        <NotificationsTab />
      </PageContent>
    </PageLayout>
  );
}
