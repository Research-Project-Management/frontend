'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import PapersView from '../components/library/views/papers-view';
import CollectionView from '../components/library/views/collection-view';

export default function LibraryPage() {
  const { collectionId } = useParams() as { collectionId?: string };

  if (collectionId) {
    return <CollectionView />;
  }

  return <PapersView />;
}
