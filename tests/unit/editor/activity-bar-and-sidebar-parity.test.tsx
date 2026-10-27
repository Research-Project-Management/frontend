import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { ActivityBar } from '@/features/editor/core/shell/ActivityBar';
import { TexFileRow } from '@/features/editor/subsystems/explorer';
import { useWorkspaceStore } from '@/features/editor/core';

// Mock manuscriptService to keep tests decoupled and fast
vi.mock('@/features/editor/sdk/manuscript.service', () => ({
  manuscriptService: {
    linkedFiles: { refresh: vi.fn() },
    docs: {
      getById: vi.fn().mockResolvedValue({ content: 'Mock content' }),
    },
  },
}));

vi.mock('@/features/editor/subsystems/review', () => ({
  useReviewPendingCount: () => ({ totalPendingCount: 0 }),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  );
};

describe('Activity Bar & Left Sidebar Overleaf 1:1 Parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      sidebarLeftOpen: true,
      activeSidebarTab: 'files',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders primary Activity Bar tabs with File Outline integrated in File Tree and zero Help or Share buttons', () => {
    renderWithProviders(<ActivityBar />);

    expect(screen.getByRole('tab', { name: /file tree/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /document outline/i })).toBeNull();
    expect(screen.getByRole('tab', { name: /search in project/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /citations & bibtex/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /review & comments/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ai assistant/i })).toBeInTheDocument();

    // Verify zero Help or Share
    expect(screen.queryByRole('tab', { name: /help/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /share/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /help/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /share/i })).toBeNull();
  });

  it('clicking Activity Bar tab selects active viewlet', () => {
    renderWithProviders(<ActivityBar />);

    const searchTab = screen.getByRole('tab', { name: /search in project/i });
    fireEvent.click(searchTab);

    expect(useWorkspaceStore.getState().activeSidebarTab).toBe('search');
    expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(true);
  });

  it('renders TexFileRow with Main document badge when isMain is true', () => {
    renderWithProviders(
      <TexFileRow
        file={{ id: 'main-doc', title: 'main.tex' }}
        isActive={true}
        isMain={true}
        isRenaming={false}
        renameValue=""
        isRenamePending={false}
        onFileClick={vi.fn()}
        onStartRename={vi.fn()}
        onRenameChange={vi.fn()}
        onCommitRename={vi.fn()}
        onCancelRename={vi.fn()}
        onDelete={vi.fn()}
        onSetMain={vi.fn()}
        onDownload={vi.fn()}
      />
    );

    expect(screen.getByText(/^main$/i)).toBeInTheDocument();
  });

  it('triggers scrollIntoView when TexFileRow becomes active', () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const { rerender } = renderWithProviders(
      <TexFileRow
        file={{ id: 'doc-ch1', title: 'chapter1.tex' }}
        isActive={false}
        isMain={false}
        isRenaming={false}
        renameValue=""
        isRenamePending={false}
        onFileClick={vi.fn()}
        onStartRename={vi.fn()}
        onRenameChange={vi.fn()}
        onCommitRename={vi.fn()}
        onCancelRename={vi.fn()}
        onDelete={vi.fn()}
        onSetMain={vi.fn()}
        onDownload={vi.fn()}
      />
    );

    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <TooltipProvider>
          <TexFileRow
            file={{ id: 'doc-ch1', title: 'chapter1.tex' }}
            isActive={true}
            isMain={false}
            isRenaming={false}
            renameValue=""
            isRenamePending={false}
            onFileClick={vi.fn()}
            onStartRename={vi.fn()}
            onRenameChange={vi.fn()}
            onCommitRename={vi.fn()}
            onCancelRename={vi.fn()}
            onDelete={vi.fn()}
            onSetMain={vi.fn()}
            onDownload={vi.fn()}
          />
        </TooltipProvider>
      </QueryClientProvider>
    );

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
  });

  it('calls onDownload when download action is triggered in TexFileRow', async () => {
    const onDownloadMock = vi.fn();

    renderWithProviders(
      <TexFileRow
        file={{ id: 'doc-ch1', title: 'chapter1.tex' }}
        isActive={false}
        isMain={false}
        isRenaming={false}
        renameValue=""
        isRenamePending={false}
        onFileClick={vi.fn()}
        onStartRename={vi.fn()}
        onRenameChange={vi.fn()}
        onCommitRename={vi.fn()}
        onCancelRename={vi.fn()}
        onDelete={vi.fn()}
        onSetMain={vi.fn()}
        onDownload={onDownloadMock}
      />
    );

    // Right-click to open ContextMenu
    const fileRow = screen.getByRole('button', { name: /file chapter1\.tex/i });
    fireEvent.contextMenu(fileRow);

    const downloadItem = await screen.findByRole('menuitem', { name: /download/i });
    fireEvent.click(downloadItem);

    expect(onDownloadMock).toHaveBeenCalledWith({ id: 'doc-ch1', title: 'chapter1.tex' });
  });
});
