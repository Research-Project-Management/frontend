'use client';

import React from 'react';
import LibraryPage from './LibraryPage';

/**
 * Recently Read View
 * Seamlessly powered by LibraryPage and useLibrary with activeFilter="recent-read".
 * Displays recently read references in descending chronological order with
 * 18 customizable columns, density toggles, and multi-criteria filters.
 */
export default function RecentlyReadPage() {
  return <LibraryPage />;
}
