'use client';

import React from 'react';
import { useYourWorkContext } from '../context/your-work.context';
import { ItemList } from '../components/shared/ItemList';
import { PageLayout } from '../components/shared/PageLayout';

export function CreatedPage() {
  const { created, workItemProjectMap, isLoading, isError, error, openWorkItem } =
    useYourWorkContext();

  return (
    <PageLayout isLoading={isLoading} isError={isError} error={error}>
      <ItemList
        variant="created"
        workItems={created}
        onWorkItemClick={openWorkItem}
        workItemProjectMap={workItemProjectMap}
      />
    </PageLayout>
  );
}

export default CreatedPage;
