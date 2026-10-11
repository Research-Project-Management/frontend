'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { PageLayout, PageContent } from '@/shared/components/layout/PageLayout';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import NotificationsTab from '../components/notifications/NotificationsTab';

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
