'use client';

import React from 'react';
import { User } from 'lucide-react';
import { PageLayout, PageContent } from '@/shared/components/layout/PageLayout';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import ProfileTab from '../components/profile/ProfileTab';

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
