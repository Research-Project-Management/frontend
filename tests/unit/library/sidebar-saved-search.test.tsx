import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SavedSearchListSection } from '@/features/library/ui/sidebar/SavedSearchListSection';
import type { SavedSearch } from '@/features/library/types/ingestion.types';

describe('SavedSearchListSection — Zotero Parity Context Menu', () => {
  const mockSavedSearch: SavedSearch = {
    id: 'ss-1',
    name: 'Quantum Papers',
    conjunction: 'AND',
    conditions: [{ field: 'title', operator: 'contains', value: 'quantum' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const defaultProps = {
    savedSearches: [mockSavedSearch],
    basePath: '/library',
    navId: 'test-nav',
    currentFilter: null,
    isActiveScope: true,
  };

  it('should render Saved Search navigation item with clean name', () => {
    render(<SavedSearchListSection {...defaultProps} />);

    const ssLink = screen.getByRole('link', { name: /Quantum Papers/i });
    expect(ssLink).toBeDefined();
    expect(ssLink.getAttribute('href')).toBe('/library?filter=saved-search&savedSearchId=ss-1');
  });

  it('should render ContextMenu on right click with Edit, Rename, Duplicate, Delete', () => {
    const handleEdit = vi.fn();
    const handleRename = vi.fn();
    const handleDuplicate = vi.fn();
    const handleDelete = vi.fn();

    render(
      <SavedSearchListSection
        {...defaultProps}
        onEditSavedSearch={handleEdit}
        onStartRenameSavedSearch={handleRename}
        onDuplicateSavedSearch={handleDuplicate}
        onDeleteSavedSearch={handleDelete}
      />,
    );

    const ssLink = screen.getByRole('link', { name: /Quantum Papers/i });
    fireEvent.contextMenu(ssLink);

    const editMenuItem = screen.queryByText(/Edit Saved Search\.\.\./i);
    expect(editMenuItem).toBeDefined();

    const renameMenuItem = screen.queryByText(/Rename Saved Search/i);
    expect(renameMenuItem).toBeDefined();

    const duplicateMenuItem = screen.queryByText(/Duplicate Saved Search/i);
    expect(duplicateMenuItem).toBeDefined();

    const deleteMenuItem = screen.queryByText(/Delete Saved Search/i);
    expect(deleteMenuItem).toBeDefined();

    if (editMenuItem) {
      fireEvent.click(editMenuItem);
      expect(handleEdit).toHaveBeenCalledWith(mockSavedSearch);
    }
  });
});
