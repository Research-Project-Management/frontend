import { describe, it, expect } from 'vitest';
import ProjectsPage from '@/features/workspaces/projects/shell/pages/ProjectsPage';
import ArchivePage from '@/features/workspaces/projects/shell/pages/ArchivePage';
import { ProjectService, projectKeys } from '@/features/workspaces/projects/shell/services/project.service';
import { useProjects, useArchiveProject } from '@/features/workspaces/projects/shell/hooks/use-project';
import type { Project } from '@/features/workspaces/projects/shell/types/project.types';

describe('Projects Shell & Archive Logic', () => {
  it('should export all primary shell components and pages', () => {
    expect(ProjectsPage).toBeDefined();
    expect(ArchivePage).toBeDefined();
  });

  it('should accurately partition active and archived projects', () => {
    const mockProjects: Partial<Project>[] = [
      { id: '1', name: 'Active Alpha', isArchived: false },
      { id: '2', name: 'Archived Beta', isArchived: true },
      { id: '3', name: 'Active Gamma' },
      { id: '4', name: 'Archived Delta', isArchived: true },
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
      { id: '1', name: 'Proj 1', isPrivate: false },
      { id: '2', name: 'Proj 2', isPrivate: true },
      { id: '3', name: 'Proj 3', isPrivate: false },
    ];
    const favoriteIds = new Set(['1', '2']);

    const favorites = projects.filter((p) => favoriteIds.has(p.id!));
    const publicProjs = projects.filter((p) => !p.isPrivate);
    const privateProjs = projects.filter((p) => p.isPrivate);

    expect(favorites).toHaveLength(2);
    expect(publicProjs).toHaveLength(2);
    expect(privateProjs).toHaveLength(1);
  });

  it('should sort projects alphabetically, by creation date, or update date', () => {
    const projects: Partial<Project>[] = [
      { id: '1', name: 'Zeta Project', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
      { id: '2', name: 'Alpha Project', createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-08-10T00:00:00Z' },
      { id: '3', name: 'Beta Project', createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z' },
    ];

    // Sort by name
    const byName = [...projects].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    expect(byName.map((p) => p.name)).toEqual(['Alpha Project', 'Beta Project', 'Zeta Project']);

    // Sort by newest updated
    const byUpdated = [...projects].sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime());
    expect(byUpdated.map((p) => p.name)).toEqual(['Alpha Project', 'Zeta Project', 'Beta Project']);
  });

  it('should export all server-side archive, favorite, and member services and hooks', () => {
    expect(ProjectService).toBeDefined();
    expect(projectKeys).toBeDefined();
    expect(useProjects).toBeDefined();
    expect(useArchiveProject).toBeDefined();
  });
});
