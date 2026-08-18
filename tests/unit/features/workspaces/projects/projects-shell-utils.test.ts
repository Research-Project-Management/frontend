import { describe, it, expect } from 'vitest';
import {
  getProjectKey,
  getBannerGradient,
  isProjectPrivate,
  filterActiveProjects,
  filterProjectsByVisibility,
  searchProjects,
  sortProjects,
  calculateProjectFilterCounts,
  filterProjectsByCriteria,
  countActiveCriteria,
} from '@/features/workspaces/projects/shell/utils/projects-page.util';
import {
  filterArchivedProjects,
  searchArchivedProjects,
  getArchiveBannerGradient,
} from '@/features/workspaces/projects/shell/utils/archive-page.util';
import type { Project } from '@/features/workspaces/projects/shell/types/project.types';

describe('Projects Shell Utilities (projects-page.util & archive-page.util)', () => {
  describe('projects-page.util', () => {
    it('generates standardized project keys from names', () => {
      expect(getProjectKey('Quantum Computing')).toBe('QUACO');
      expect(getProjectKey('Algorithm')).toBe('ALGOR');
      expect(getProjectKey('')).toBe('PROJ');
    });

    it('returns deterministic gradient classes', () => {
      const grad1 = getBannerGradient('project-123');
      const grad2 = getBannerGradient('project-123');
      expect(grad1).toBe(grad2);
      expect(grad1).toContain('from-');
    });

    it('determines project privacy accurately', () => {
      expect(isProjectPrivate({ isPrivate: true })).toBe(true);
      expect(isProjectPrivate({ isPrivate: false })).toBe(false);
      expect(isProjectPrivate({ settings: { isPrivate: true } } as any)).toBe(true);
      expect(isProjectPrivate({})).toBe(false);
    });

    it('filters active vs archived projects', () => {
      const list: Partial<Project>[] = [
        { id: '1', name: 'P1', isArchived: false },
        { id: '2', name: 'P2', isArchived: true },
        { id: '3', name: 'P3' },
      ];
      const active = filterActiveProjects(list as Project[]);
      expect(active).toHaveLength(2);
      expect(active.map((p) => p.id)).toEqual(['1', '3']);
    });

    it('filters projects by visibility', () => {
      const list: Partial<Project>[] = [
        { id: '1', name: 'Public P1', isPrivate: false },
        { id: '2', name: 'Private P2', isPrivate: true },
      ];
      expect(filterProjectsByVisibility(list as Project[], 'all')).toHaveLength(2);
      expect(filterProjectsByVisibility(list as Project[], 'public')).toHaveLength(1);
      expect(filterProjectsByVisibility(list as Project[], 'private')).toHaveLength(1);
    });

    it('searches projects across name, description, identifier and key', () => {
      const list: Partial<Project>[] = [
        { id: '1', name: 'Alpha Project', description: 'Deep learning paper', identifier: 'ALP-1' },
        { id: '2', name: 'Beta Project', description: 'Genomics workflow', key: 'GEN-2' },
      ];
      expect(searchProjects(list as Project[], 'deep')).toHaveLength(1);
      expect(searchProjects(list as Project[], 'GEN-2')).toHaveLength(1);
      expect(searchProjects(list as Project[], 'nonexistent')).toHaveLength(0);
    });

    it('sorts projects by name, created, or updated date', () => {
      const list: Partial<Project>[] = [
        { id: '1', name: 'Zeta', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z' },
        { id: '2', name: 'Alpha', createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-08-10T00:00:00Z' },
      ];
      const sortedName = sortProjects(list as Project[], 'name');
      expect(sortedName[0]!.name).toBe('Alpha');

      const sortedUpdated = sortProjects(list as Project[], 'updated');
      expect(sortedUpdated[0]!.name).toBe('Alpha');
    });

    it('calculates project filter statistics', () => {
      const list: Partial<Project>[] = [
        { id: '1', isPrivate: false },
        { id: '2', isPrivate: true },
        { id: '3', isPrivate: false },
      ];
      const counts = calculateProjectFilterCounts(list as Project[]);
      expect(counts).toEqual({
        all: 3,
        public: 2,
        private: 1,
      });
    });

    it('filters projects by criteria (My projects, Access, Leads, Members, Date)', () => {
      const list: Partial<Project>[] = [
        {
          id: '1',
          name: 'My Public Project',
          isPrivate: false,
          createdBy: { id: 'user-1', name: 'User 1' } as any,
          members: [{ role: 'lead', user: { id: 'user-1', name: 'User 1' } }] as any,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Colleague Private Project',
          isPrivate: true,
          createdBy: { id: 'user-2', name: 'User 2' } as any,
          members: [{ role: 'lead', user: { id: 'user-2', name: 'User 2' } }] as any,
          createdAt: '2025-01-01T00:00:00Z',
        },
      ];

      // My projects
      const myProjs = filterProjectsByCriteria(list as Project[], { myProjects: true }, 'user-1');
      expect(myProjs).toHaveLength(1);
      expect(myProjs[0]!.id).toBe('1');

      // Access filter
      const privateProjs = filterProjectsByCriteria(list as Project[], { access: ['private'] });
      expect(privateProjs).toHaveLength(1);
      expect(privateProjs[0]!.id).toBe('2');

      // Lead filter
      const leadProjs = filterProjectsByCriteria(list as Project[], { leads: ['user-2'] });
      expect(leadProjs).toHaveLength(1);
      expect(leadProjs[0]!.id).toBe('2');

      // Created date filter (today)
      const todayProjs = filterProjectsByCriteria(list as Project[], { createdDate: 'today' });
      expect(todayProjs).toHaveLength(1);
      expect(todayProjs[0]!.id).toBe('1');
    });
  });

  describe('archive-page.util', () => {
    it('filters only archived projects', () => {
      const list: Partial<Project>[] = [
        { id: '1', name: 'Active', isArchived: false },
        { id: '2', name: 'Archived', isArchived: true },
      ];
      const res = filterArchivedProjects(list as Project[]);
      expect(res).toHaveLength(1);
      expect(res[0]!.id).toBe('2');
    });

    it('searches archived projects', () => {
      const list: Partial<Project>[] = [
        { id: '1', name: 'Legacy Survey', isArchived: true },
        { id: '2', name: 'Obsolete Benchmark', isArchived: true },
      ];
      expect(searchArchivedProjects(list as Project[], 'survey')).toHaveLength(1);
      expect(searchArchivedProjects(list as Project[], 'survey')[0]!.id).toBe('1');
    });

    it('returns archive banner gradients', () => {
      const grad = getArchiveBannerGradient('arch-1');
      expect(grad).toBeDefined();
      expect(grad).toContain('from-');
    });
  });
});
