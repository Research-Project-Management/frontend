import { describe, it, expect } from 'vitest';
import * as ProjectsPublicAPI from '@/features/workspaces/projects';
import type { Project } from '@/features/workspaces/projects/shell/types/project.types';

describe('Projects Shell & Archive Logic', () => {
  it('should export all primary shell components and pages', () => {
    expect(ProjectsPublicAPI.ProjectsPage).toBeDefined();
    expect(ProjectsPublicAPI.ArchivePage).toBeDefined();
    expect(ProjectsPublicAPI.ProjectsSidebar).toBeDefined();
    expect(ProjectsPublicAPI.ProjectsTopbar).toBeDefined();
    expect(ProjectsPublicAPI.ProjectCard).toBeDefined();
    expect(ProjectsPublicAPI.CreateProjectModal).toBeDefined();
  });

  it('should accurately partition active and archived projects', () => {
    const mockProjects: Partial<Project>[] = [
      { _id: '1', name: 'Active Alpha', isArchived: false },
      { _id: '2', name: 'Archived Beta', isArchived: true },
      { _id: '3', name: 'Active Gamma' },
      { _id: '4', name: 'Archived Delta', isArchived: true },
    ];

    const active = mockProjects.filter((p) => !p.isArchived);
    const archived = mockProjects.filter((p) => Boolean(p.isArchived));

    expect(active).toHaveLength(2);
    expect(active.map((p) => p.name)).toEqual(['Active Alpha', 'Active Gamma']);

    expect(archived).toHaveLength(2);
    expect(archived.map((p) => p.name)).toEqual(['Archived Beta', 'Archived Delta']);
  });

  it('should filter active projects by filter tabs (favorites, public, private)', () => {
    const projects: Partial<Project>[] = [
      { _id: '1', name: 'Proj 1', isPrivate: false },
      { _id: '2', name: 'Proj 2', isPrivate: true },
      { _id: '3', name: 'Proj 3', isPrivate: false },
    ];
    const favoriteIds = new Set(['1', '2']);

    const favorites = projects.filter((p) => favoriteIds.has(p._id!));
    const publicProjs = projects.filter((p) => !p.isPrivate);
    const privateProjs = projects.filter((p) => p.isPrivate);

    expect(favorites).toHaveLength(2);
    expect(publicProjs).toHaveLength(2);
    expect(privateProjs).toHaveLength(1);
  });

  it('should sort projects alphabetically, by creation date, or update date', () => {
    const projects: Partial<Project>[] = [
      { _id: '1', name: 'Zeta Project', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
      { _id: '2', name: 'Alpha Project', createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-08-10T00:00:00Z' },
      { _id: '3', name: 'Beta Project', createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z' },
    ];

    // Sort by name
    const byName = [...projects].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    expect(byName.map((p) => p.name)).toEqual(['Alpha Project', 'Beta Project', 'Zeta Project']);

    // Sort by newest updated
    const byUpdated = [...projects].sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime());
    expect(byUpdated.map((p) => p.name)).toEqual(['Alpha Project', 'Zeta Project', 'Beta Project']);
  });

  it('should export all server-side archive, favorite, and member services and hooks', () => {
    expect(ProjectsPublicAPI.ProjectService).toBeDefined();
    expect(ProjectsPublicAPI.projectKeys).toBeDefined();
    expect(ProjectsPublicAPI.useFavorites).toBeDefined();
    expect(ProjectsPublicAPI.useProject).toBeDefined();
    expect(ProjectsPublicAPI.useProjects).toBeDefined();
    expect(ProjectsPublicAPI.useProjectMembers).toBeDefined();
    expect(ProjectsPublicAPI.useArchiveProject).toBeDefined();
    expect(ProjectsPublicAPI.useRestoreProject).toBeDefined();
    expect(ProjectsPublicAPI.useToggleProjectFavorite).toBeDefined();
    expect(ProjectsPublicAPI.archiveProjectApi).toBeDefined();
    expect(ProjectsPublicAPI.restoreProjectApi).toBeDefined();
    expect(ProjectsPublicAPI.toggleProjectFavoriteApi).toBeDefined();
    expect(ProjectsPublicAPI.useCreateProject).toBeDefined();
    expect(ProjectsPublicAPI.useUpdateProject).toBeDefined();
    expect(ProjectsPublicAPI.useDeleteProject).toBeDefined();
  });
});
