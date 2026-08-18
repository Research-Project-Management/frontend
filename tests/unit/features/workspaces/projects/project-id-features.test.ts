import { describe, it, expect } from 'vitest';
import OverviewPage from '@/features/workspaces/projects/project-id/overview/pages/OverviewPage';
import { useOverview } from '@/features/workspaces/projects/project-id/overview/hooks/use-overview';
import { CyclePage } from '@/features/workspaces/projects/project-id/cycles/pages/CyclePage';
import { useProjectCycles, useCreateCycle } from '@/features/workspaces/projects/project-id/cycles/hooks/use-cycle';
import PagesPage from '@/features/workspaces/projects/all-pages/pages/PagesPage';
import { usePageActions } from '@/features/workspaces/projects/all-pages/hooks/use-page';
import ProjectStorageHomePage from '@/features/workspaces/projects/project-id/storage/pages/HomePage';
import { usePreviewStore } from '@/features/workspaces/projects/project-id/storage/store/use-preview-store';
import TaskPage from '@/features/workspaces/projects/project-id/tasks/pages/TaskPage';
import { useProjectTasks } from '@/features/workspaces/projects/project-id/tasks/hooks/use-task';

describe('Projects Global Domain API Health Check (Direct Layered Imports)', () => {
  it('should cleanly import Overview components and hooks', () => {
    expect(OverviewPage).toBeDefined();
    expect(useOverview).toBeDefined();
  });

  it('should cleanly import Cycles components and hooks', () => {
    expect(CyclePage).toBeDefined();
    expect(useProjectCycles).toBeDefined();
    expect(useCreateCycle).toBeDefined();
  });

  it('should cleanly import Pages components and hooks', () => {
    expect(PagesPage).toBeDefined();
    expect(usePageActions).toBeDefined();
  });

  it('should cleanly import Storage components and store', () => {
    expect(ProjectStorageHomePage).toBeDefined();
    expect(usePreviewStore).toBeDefined();
  });

  it('should correctly handle Storage Preview Store state transitions', () => {
    expect(usePreviewStore.getState().selectedItem).toBeNull();

    const mockItem = {
      id: 'file-123',
      name: 'paper.pdf',
      type: 'file' as const,
      size: 1024,
      mimeType: 'application/pdf',
      updatedAt: '2026-08-17T00:00:00Z',
    };

    usePreviewStore.getState().setSelectedItem(mockItem as any);
    expect(usePreviewStore.getState().selectedItem?.id).toBe('file-123');

    usePreviewStore.getState().setSelectedItem(null);
    expect(usePreviewStore.getState().selectedItem).toBeNull();
  });

  it('should cleanly import Tasks components and hooks', () => {
    expect(TaskPage).toBeDefined();
    expect(useProjectTasks).toBeDefined();
  });
});
