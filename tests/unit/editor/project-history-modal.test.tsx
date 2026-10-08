import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectHistoryModal from '@/features/editor/ui/modals/ProjectHistoryModal';
import { historyService } from '@/features/editor/coordinators/services/history.service';
import { manuscriptService } from '@/features/editor/coordinators/services/manuscript.service';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { usePageStore } from '@/features/editor/store';
import type { ProjectVersionListItem, ProjectDiffResponse } from '@/features/editor/domain/types/history.types';

describe('ProjectHistoryModal Component (Overleaf Parity)', () => {
  let queryClient: QueryClient;

  const mockVersions: ProjectVersionListItem[] = [
    {
      id: 'v3-id',
      projectId: 'proj-123',
      version: 3,
      summary: 'Added bibliography references',
      isAutomatic: false,
      fileCount: 2,
      labels: [{ id: 'lbl-1', version: 3, label: 'Release-Candidate', createdAt: new Date().toISOString() }],
      createdAt: '2026-10-08T10:00:00Z',
    },
    {
      id: 'v2-id',
      projectId: 'proj-123',
      version: 2,
      summary: 'Drafted Section 2 Methodology',
      isAutomatic: true,
      fileCount: 2,
      labels: [],
      createdAt: '2026-10-08T09:00:00Z',
    },
    {
      id: 'v1-id',
      projectId: 'proj-123',
      version: 1,
      summary: 'Initial project setup',
      isAutomatic: false,
      fileCount: 1,
      labels: [{ id: 'lbl-0', version: 1, label: 'Initial Draft', createdAt: new Date().toISOString() }],
      createdAt: '2026-10-08T08:00:00Z',
    },
  ];

  const mockDiff: ProjectDiffResponse = {
    baseVersion: 2,
    targetVersion: 3,
    totalAdditions: 8,
    totalDeletions: 2,
    filesChanged: 1,
    files: [
      {
        path: 'main.tex',
        status: 'modified',
        type: 'doc',
        additions: 8,
        deletions: 2,
        hunks: [
          {
            oldStartLine: 1,
            oldLineCount: 3,
            newStartLine: 1,
            newLineCount: 4,
            lines: [
              { type: 'unchanged', text: '\\documentclass{article}', oldLineNumber: 1, newLineNumber: 1 },
              { type: 'deleted', text: 'Old methodology', oldLineNumber: 2, words: [{ type: 'deleted', text: 'Old methodology' }] },
              { type: 'added', text: 'State of the art deep learning architecture', newLineNumber: 2, words: [{ type: 'added', text: 'State of the art deep learning architecture' }] },
            ],
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    usePageStore.setState({
      projectId: 'proj-123',
      currentPage: { id: 'p-1', projectId: 'proj-123' } as any,
    });

    vi.spyOn(manuscriptService.history, 'getProjectVersions').mockResolvedValue(mockVersions);
    vi.spyOn(manuscriptService.history, 'compareProjectVersions').mockResolvedValue(mockDiff);
    vi.spyOn(manuscriptService.history, 'getProjectSnapshot').mockResolvedValue({
      id: 'snap-2',
      projectId: 'proj-123',
      version: 2,
      summary: 'Drafted Section 2 Methodology',
      createdById: 'user-1',
      isAutomatic: true,
      fileCount: 1,
      labels: [],
      createdAt: '2026-10-08T09:00:00Z',
      files: {
        'main.tex': {
          path: '/main.tex',
          type: 'doc',
          docId: 'p-1',
          hash: 'hash-2',
          sizeBytes: 45,
          lines: ['\\documentclass{article}', 'Old methodology'],
        },
      },
    });
    vi.spyOn(manuscriptService.history, 'createProjectSnapshot').mockResolvedValue({
      id: 'snap-4',
      version: 4,
    } as any);
    vi.spyOn(manuscriptService.docs, 'updateContent').mockResolvedValue({} as any);
    vi.spyOn(manuscriptService.history, 'restoreProjectVersion').mockResolvedValue({
      restoredSnapshot: { version: 2 } as any,
      newSnapshot: { version: 4 } as any,
      restoreResult: { restoredFilesCount: 2, restoredDocIds: ['doc-1'] },
    });

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  function renderModal(props = {}) {
    return render(
      <QueryClientProvider client={queryClient}>
        <ProjectHistoryModal
          open={true}
          onOpenChange={vi.fn()}
          projectId="proj-123"
          {...props}
        />
      </QueryClientProvider>
    );
  }

  it('renders Project History title, total versions count, and version list', async () => {
    renderModal();

    expect(screen.getByText('Project History')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Added bibliography references')).toBeDefined();
      expect(screen.getByText('Drafted Section 2 Methodology')).toBeDefined();
      expect(screen.getByText('Initial project setup')).toBeDefined();
    });

    // Check version pills
    expect(screen.getByText('v3')).toBeDefined();
    expect(screen.getByText('v2')).toBeDefined();
    expect(screen.getByText('v1')).toBeDefined();
  });

  it('filters versions when typing in search input', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Added bibliography references')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText('Filter versions or labels...');
    fireEvent.change(searchInput, { target: { value: 'Methodology' } });

    await waitFor(() => {
      expect(screen.queryByText('Added bibliography references')).toBeNull();
      expect(screen.getByText('Drafted Section 2 Methodology')).toBeDefined();
    });
  });

  it('filters to only labelled revisions when clicking "Labelled" tab', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Added bibliography references')).toBeDefined();
    });

    const labelledTab = screen.getByText(/Labelled/);
    fireEvent.click(labelledTab);

    await waitFor(() => {
      // v3 has 'Release-Candidate' and v1 has 'Initial Draft', v2 has no labels
      expect(screen.getByText('Added bibliography references')).toBeDefined();
      expect(screen.getByText('Initial project setup')).toBeDefined();
      expect(screen.queryByText('Drafted Section 2 Methodology')).toBeNull();
    });
  });

  it('renders diff stats and unified diff hunks correctly', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getAllByText('+8').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('-2').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('State of the art deep learning architecture')).toBeDefined();
      expect(screen.getByText('Old methodology')).toBeDefined();
    });
  });

  it('allows switching view mode between Unified and Split, rendering side-by-side synchronized columns', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Unified')).toBeDefined();
      expect(screen.getByText('Split')).toBeDefined();
    });

    const splitBtn = screen.getByText('Split');
    fireEvent.click(splitBtn);

    // Verifies side-by-side column headers and aligned content
    await waitFor(() => {
      expect(screen.getByText('Base: v2')).toBeDefined();
      expect(screen.getByText('Target: v3')).toBeDefined();
      expect(screen.getByText('Old methodology')).toBeDefined();
      expect(screen.getByText('State of the art deep learning architecture')).toBeDefined();
    });
  });

  it('allows copying hunk diff, base snippet, and target snippet to clipboard', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Hunk')).toBeDefined();
      expect(screen.getByText('Base v2')).toBeDefined();
      expect(screen.getByText('Target v3')).toBeDefined();
    });

    const hunkBtn = screen.getByText('Hunk');
    fireEvent.click(hunkBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('+ State of the art deep learning architecture')
    );

    const baseHunkBtn = screen.getByText('Base v2');
    fireEvent.click(baseHunkBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Old methodology')
    );

    const targetHunkBtn = screen.getByText('Target v3');
    fireEvent.click(targetHunkBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('State of the art deep learning architecture')
    );
  });

  it('allows 1-click copying of entire base file content to clipboard', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText(/Copy v2 File/)).toBeDefined();
    });

    const copyFileBtn = screen.getByText(/Copy v2 File/);
    fireEvent.click(copyFileBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        '\\documentclass{article}\nOld methodology'
      );
    });
  });

  it('confirms and executes 1-click partial single file restore flow', async () => {
    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Restore this file')).toBeDefined();
    });

    const restoreFileBtn = screen.getByText('Restore this file');
    fireEvent.click(restoreFileBtn);

    // Transitions to confirmation state
    await waitFor(() => {
      expect(screen.getByText(/Confirm restore main\.tex to v2/)).toBeDefined();
    });

    const confirmFileBtn = screen.getByText(/Confirm restore main\.tex to v2/);
    fireEvent.click(confirmFileBtn);

    await waitFor(() => {
      // Fetches base snapshot v2
      expect(manuscriptService.history.getProjectSnapshot).toHaveBeenCalledWith('proj-123', 2);
      // Updates document content
      expect(manuscriptService.docs.updateContent).toHaveBeenCalledWith('p-1', '\\documentclass{article}\nOld methodology');
      // Captures non-destructive checkpoint
      expect(manuscriptService.history.createProjectSnapshot).toHaveBeenCalledWith(
        'proj-123',
        expect.objectContaining({ summary: 'Restored main.tex from Version 2' })
      );
      // Dispatches filetree update
      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'filetree:updated' });
    });
  });

  it('confirms and executes restore entire project version flow', async () => {
    const onOpenChange = vi.fn();
    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

    renderModal({ onOpenChange });

    await waitFor(() => {
      expect(screen.getByText('Restore this version')).toBeDefined();
    });

    const restoreBtn = screen.getByText('Restore this version');
    fireEvent.click(restoreBtn);

    // Button transitions to confirmation state
    await waitFor(() => {
      expect(screen.getByText(/Confirm restore to v3/)).toBeDefined();
    });

    const confirmBtn = screen.getByText(/Confirm restore to v3/);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(manuscriptService.history.restoreProjectVersion).toHaveBeenCalledWith('proj-123', 3);
      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'filetree:updated' });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
