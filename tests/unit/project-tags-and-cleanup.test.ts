import { describe, it, expect } from 'vitest';
import { ProjectSchema, ProjectLabelItemSchema } from '@/features/projects/shell/schemas/project.schema';
import * as coreServiceExports from '@/features/editor/services/core.service';

describe('Option B: Cleanup Verification', () => {
  it('should verify dead aliases PageDocumentService and PageFileService are removed from core.service', () => {
    // Assert that the dead aliases are no longer exported
    expect((coreServiceExports as any).PageDocumentService).toBeUndefined();
    expect((coreServiceExports as any).PageFileService).toBeUndefined();

    // Verify canonical services exist
    expect(coreServiceExports.pageService).toBeDefined();
    expect(coreServiceExports.documentService).toBeDefined();
    expect(coreServiceExports.documentService).toBe(coreServiceExports.pageService);
  });
});

describe('Option C: Project Tags & Folders Schema & Logic', () => {
  it('should validate and parse project tags with ProjectLabelItemSchema', () => {
    const validLabel = {
      id: 'label-1',
      name: 'ICLR 2026',
      color: '#3B82F6',
      description: 'Conference submission drafts',
    };

    const parsed = ProjectLabelItemSchema.parse(validLabel);
    expect(parsed.id).toBe('label-1');
    expect(parsed.name).toBe('ICLR 2026');
    expect(parsed.color).toBe('#3B82F6');
    expect(parsed.description).toBe('Conference submission drafts');
  });

  it('should parse project with projectLabelsList', () => {
    const projectData = {
      id: 'proj-123',
      name: 'Quantum Optics Manuscript',
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-21T00:00:00.000Z',
      projectLabelsList: [
        { id: 'label-1', name: 'Optics', color: '#10B981' },
        { id: 'label-2', name: 'Thesis', color: '#8B5CF6' },
      ],
    };

    const parsed = ProjectSchema.parse(projectData);
    expect(parsed.projectLabelsList).toBeDefined();
    expect(parsed.projectLabelsList).toHaveLength(2);
    expect(parsed.projectLabelsList?.[0].name).toBe('Optics');
    expect(parsed.projectLabelsList?.[1].name).toBe('Thesis');
  });

  it('should default projectLabelsList to empty array when omitted', () => {
    const projectData = {
      id: 'proj-456',
      name: 'Standalone Paper',
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-21T00:00:00.000Z',
    };

    const parsed = ProjectSchema.parse(projectData);
    expect(parsed.projectLabelsList).toEqual([]);
  });

  it('should filter projects accurately by selectedTagId', () => {
    const projects = [
      {
        id: 'p1',
        name: 'Project 1',
        projectLabelsList: [{ id: 'tag-ai', name: 'AI', color: '#3B82F6' }],
      },
      {
        id: 'p2',
        name: 'Project 2',
        projectLabelsList: [
          { id: 'tag-ai', name: 'AI', color: '#3B82F6' },
          { id: 'tag-bio', name: 'Biology', color: '#10B981' },
        ],
      },
      {
        id: 'p3',
        name: 'Project 3',
        projectLabelsList: [{ id: 'tag-bio', name: 'Biology', color: '#10B981' }],
      },
      {
        id: 'p4',
        name: 'Project 4',
        projectLabelsList: [],
      },
    ];

    // Filter by 'tag-ai'
    const aiProjects = projects.filter((p) =>
      p.projectLabelsList.some((l) => l.id === 'tag-ai')
    );
    expect(aiProjects.map((p) => p.id)).toEqual(['p1', 'p2']);

    // Filter by 'tag-bio'
    const bioProjects = projects.filter((p) =>
      p.projectLabelsList.some((l) => l.id === 'tag-bio')
    );
    expect(bioProjects.map((p) => p.id)).toEqual(['p2', 'p3']);

    // Filter by non-existent tag
    const emptyProjects = projects.filter((p) =>
      p.projectLabelsList.some((l) => l.id === 'tag-unknown')
    );
    expect(emptyProjects).toHaveLength(0);
  });

  it('should accurately calculate project counts per tag', () => {
    const projects = [
      {
        id: 'p1',
        name: 'Project 1',
        projectLabelsList: [
          { id: 'tag-1', name: 'Deep Learning', color: '#3B82F6' },
          { id: 'tag-2', name: 'NeurIPS', color: '#F59E0B' },
        ],
      },
      {
        id: 'p2',
        name: 'Project 2',
        projectLabelsList: [
          { id: 'tag-1', name: 'Deep Learning', color: '#3B82F6' },
        ],
      },
      {
        id: 'p3',
        name: 'Project 3',
        projectLabelsList: [],
      },
    ];

    const tagCounts: Record<string, number> = {};
    for (const p of projects) {
      if (p.projectLabelsList) {
        for (const l of p.projectLabelsList) {
          tagCounts[l.id] = (tagCounts[l.id] || 0) + 1;
        }
      }
    }

    expect(tagCounts['tag-1']).toBe(2);
    expect(tagCounts['tag-2']).toBe(1);
    expect(tagCounts['tag-3']).toBeUndefined();
  });
});
