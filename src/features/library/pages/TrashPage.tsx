'use client';

import React from 'react';
import { ModernLibraryPage } from './LibraryPage';

/**
 * TrashPage - Thin page wrapper around ModernLibraryPage in trash view mode
 * Replaces previous 1,039-line redundant God file.
 */
export function TrashPage() {
  return <ModernLibraryPage view="trash" title="Trash" />;
}

export default TrashPage;
