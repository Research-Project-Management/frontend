'use client';

import React from 'react';
import { User } from 'lucide-react';
import { PageLayout, PageHeader, PageContent } from '@/shared/components/layout';
import ProfileTab from '@/features/account/components/ProfileTab';

export default function ProfilePage() {
  return (
    <PageLayout>
      <PageHeader
        title="Profile"
        icon={User}
      />
      <PageContent maxWidth="full" noPadding>
        <ProfileTab />
      </PageContent>
    </PageLayout>
  );
}
