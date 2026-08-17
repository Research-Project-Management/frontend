import { describe, it, expect } from 'vitest';
import * as ProjectsPublicAPI from '@/features/workspaces/projects';

describe('Projects Global Domain API Health Check', () => {
  it('should cleanly export Overview components and hooks', () => {
    expect(ProjectsPublicAPI.OverviewPage).toBeDefined();
    expect(ProjectsPublicAPI.useOverview).toBeDefined();
    expect(ProjectsPublicAPI.OverviewStats).toBeDefined();
    expect(ProjectsPublicAPI.OverviewTeam).toBeDefined();
    expect(ProjectsPublicAPI.OverviewTopbar).toBeDefined();
  });

  it('should cleanly export Cycles components and hooks', () => {
    expect(ProjectsPublicAPI.CyclePage).toBeDefined();
    expect(ProjectsPublicAPI.useProjectCycles).toBeDefined();
    expect(ProjectsPublicAPI.useCreateCycle).toBeDefined();
    expect(ProjectsPublicAPI.useUpdateCycle).toBeDefined();
    expect(ProjectsPublicAPI.useDeleteCycle).toBeDefined();
    expect(ProjectsPublicAPI.CycleModal).toBeDefined();
  });

  it('should cleanly export Pages components and hooks', () => {
    expect(ProjectsPublicAPI.PagesPage).toBeDefined();
    expect(ProjectsPublicAPI.usePageActions).toBeDefined();
    expect(ProjectsPublicAPI.PagesGridView).toBeDefined();
    expect(ProjectsPublicAPI.PagesListView).toBeDefined();
  });

  it('should cleanly export Storage components, hooks and store', () => {
    expect(ProjectsPublicAPI.ProjectStorageHomePage).toBeDefined();
    expect(ProjectsPublicAPI.usePreviewStore).toBeDefined();
    expect(ProjectsPublicAPI.useViewStore).toBeDefined();
    expect(ProjectsPublicAPI.useHomeFiles).toBeDefined();
    expect(ProjectsPublicAPI.useMyFiles).toBeDefined();
    expect(ProjectsPublicAPI.useSharedFiles).toBeDefined();
  });

  it('should correctly handle Storage Preview Store state transitions', () => {
    const { usePreviewStore } = ProjectsPublicAPI;
    expect(usePreviewStore.getState().selectedItem).toBeNull();

    const mockItem = {
      _id: 'file-123',
      name: 'paper.pdf',
      type: 'file' as const,
      size: 1024,
      mimeType: 'application/pdf',
      updatedAt: '2026-08-17T00:00:00Z',
    };

    usePreviewStore.getState().setSelectedItem(mockItem as any);
    expect(usePreviewStore.getState().selectedItem?._id).toBe('file-123');

    usePreviewStore.getState().setSelectedItem(null);
    expect(usePreviewStore.getState().selectedItem).toBeNull();
  });

  it('should cleanly export Settings pages and sub-modules', () => {
    expect(ProjectsPublicAPI.ProjectGeneralPage).toBeDefined();
    expect(ProjectsPublicAPI.ProjectMemberPage).toBeDefined();
    expect(ProjectsPublicAPI.ProjectLabelPage).toBeDefined();
    expect(ProjectsPublicAPI.ProjectModulesPage).toBeDefined();
    expect(ProjectsPublicAPI.ProjectCycleSettingsPage).toBeDefined();
    expect(ProjectsPublicAPI.ProjectWorklogsPage).toBeDefined();
  });

  it('should cleanly export Tasks components, services and hooks', () => {
    expect(ProjectsPublicAPI.TaskPage).toBeDefined();
    expect(ProjectsPublicAPI.useProjectTasks).toBeDefined();
    expect(ProjectsPublicAPI.useCreateTask).toBeDefined();
    expect(ProjectsPublicAPI.useUpdateTask).toBeDefined();
  });
});
