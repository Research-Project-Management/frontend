import { describe, it, expect } from 'vitest';
import { createWorkItemFormSchema } from '@/features/workspaces/projects/project-id/work-items/hooks/use-work-item';
import { projectGeneralSchema } from '@/features/workspaces/projects/project-id/settings/schemas/general.schema';

describe('React Hook Form Schemas Integration', () => {
  describe('createWorkItemFormSchema', () => {
    it('should validate a valid work item form payload', () => {
      const validForm = {
        title: 'Complete feature migration to RHF',
        description: 'Clean refactor using react-hook-form and zodResolver',
        columnId: 'todo',
        priority: 'high' as const,
        dueDate: '2026-10-01',
        startDate: '2026-09-15',
        cycleId: 'cycle-1',
        parentTaskId: null,
        labels: ['frontend', 'refactor'],
        assigneeId: 'user-1',
        assigneeIds: ['user-1'],
        attachments: {
          pages: [],
          papers: [],
          files: [],
          links: [],
        },
        createMore: false,
      };

      const result = createWorkItemFormSchema.safeParse(validForm);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Complete feature migration to RHF');
        expect(result.data.priority).toBe('high');
      }
    });

    it('should reject empty or whitespace-only title', () => {
      const emptyTitleForm = {
        title: '   ',
        description: '',
        columnId: 'todo',
        priority: 'none' as const,
        dueDate: '',
        startDate: '',
        cycleId: null,
        parentTaskId: null,
        labels: [],
        assigneeId: null,
        assigneeIds: [],
        attachments: {},
        createMore: false,
      };

      const result = createWorkItemFormSchema.safeParse(emptyTitleForm);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Title is required');
      }
    });
  });

  describe('projectGeneralSchema', () => {
    it('should validate valid project general settings', () => {
      const validProject = {
        name: 'Flux Platform',
        identifier: 'FLUX',
        description: 'Advanced workspace management platform',
        isPrivate: false,
        avatar: null,
        cover: null,
      };

      const result = projectGeneralSchema.safeParse(validProject);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Flux Platform');
        expect(result.data.identifier).toBe('FLUX');
      }
    });

    it('should reject identifier exceeding 10 characters', () => {
      const invalidProject = {
        name: 'Project Test',
        identifier: 'TOOLONGIDENTIFIER',
        description: '',
        isPrivate: false,
      };

      const result = projectGeneralSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.issues.map((i) => i.message);
        expect(errorMessages).toContain('Project ID must be at most 12 characters');
      }
    });

    it('should reject empty project name and identifier', () => {
      const emptyProject = {
        name: '',
        identifier: '',
        description: '',
        isPrivate: false,
      };

      const result = projectGeneralSchema.safeParse(emptyProject);
      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.error.issues.map((i) => i.path[0]);
        expect(fields).toContain('name');
        expect(fields).toContain('identifier');
      }
    });
  });

  describe('Library Form Schemas', () => {
    describe('addLinkSchema', () => {
      it('should validate valid web URL with optional title', async () => {
        const { addLinkSchema } = await import('@/features/workspaces/library/schemas/forms.schema');
        const valid = {
          url: 'https://arxiv.org/abs/2301.00001',
          title: 'arXiv Paper Link',
        };
        const result = addLinkSchema.safeParse(valid);
        expect(result.success).toBe(true);
      });

      it('should reject invalid URL format', async () => {
        const { addLinkSchema } = await import('@/features/workspaces/library/schemas/forms.schema');
        const invalid = {
          url: 'not-a-valid-url',
          title: 'Bad Link',
        };
        const result = addLinkSchema.safeParse(invalid);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Please enter a valid URL');
        }
      });

      it('should reject empty URL', async () => {
        const { addLinkSchema } = await import('@/features/workspaces/library/schemas/forms.schema');
        const empty = {
          url: '   ',
          title: '',
        };
        const result = addLinkSchema.safeParse(empty);
        expect(result.success).toBe(false);
      });
    });

    describe('flagRetractionSchema', () => {
      it('should validate retraction form with valid nature', async () => {
        const { flagRetractionSchema } = await import('@/features/workspaces/library/schemas/forms.schema');
        const valid = {
          nature: 'retraction' as const,
          reason: 'Data duplication found',
          noticeUrl: 'https://doi.org/10.1000/retraction',
          date: '2026-09-01',
        };
        const result = flagRetractionSchema.safeParse(valid);
        expect(result.success).toBe(true);
      });

      it('should reject invalid retraction nature enum', async () => {
        const { flagRetractionSchema } = await import('@/features/workspaces/library/schemas/forms.schema');
        const invalid = {
          nature: 'invalid_nature',
          reason: 'Some reason',
          noticeUrl: '',
          date: '',
        };
        const result = flagRetractionSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe('authorshipSchema', () => {
      it('should validate boolean confirmation state', async () => {
        const { authorshipSchema } = await import('@/features/workspaces/library/schemas/forms.schema');
        expect(authorshipSchema.safeParse({ confirmed: true }).success).toBe(true);
        expect(authorshipSchema.safeParse({ confirmed: false }).success).toBe(true);
      });
    });

    describe('collectionFormSchema', () => {
      it('should validate valid collection and reject empty name', async () => {
        const { collectionFormSchema } = await import('@/features/workspaces/library/schemas/forms.schema');
        const valid = {
          name: 'AI Research 2026',
          description: 'Papers on agents',
          color: '#3b82f6',
          parent: null,
          parentId: null,
        };
        expect(collectionFormSchema.safeParse(valid).success).toBe(true);

        const invalid = {
          name: '',
          description: '',
          color: '#3b82f6',
        };
        const result = collectionFormSchema.safeParse(invalid);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Name is required');
        }
      });
    });
  });

  describe('Reader Form Schemas', () => {
    describe('chatMessageFormSchema', () => {
      it('should validate non-empty message', async () => {
        const { chatMessageFormSchema } = await import('@/features/workspaces/reader/schemas/reader.schema');
        const result = chatMessageFormSchema.safeParse({ message: 'Summarize section 3' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.message).toBe('Summarize section 3');
        }
      });

      it('should reject empty or whitespace-only message', async () => {
        const { chatMessageFormSchema } = await import('@/features/workspaces/reader/schemas/reader.schema');
        expect(chatMessageFormSchema.safeParse({ message: '' }).success).toBe(false);
        expect(chatMessageFormSchema.safeParse({ message: '   ' }).success).toBe(false);
      });
    });

    describe('pageNavFormSchema', () => {
      it('should validate positive integer page', async () => {
        const { pageNavFormSchema } = await import('@/features/workspaces/reader/schemas/reader.schema');
        const result = pageNavFormSchema.safeParse({ page: 42 });
        expect(result.success).toBe(true);
      });

      it('should reject non-positive or float page numbers', async () => {
        const { pageNavFormSchema } = await import('@/features/workspaces/reader/schemas/reader.schema');
        expect(pageNavFormSchema.safeParse({ page: 0 }).success).toBe(false);
        expect(pageNavFormSchema.safeParse({ page: -5 }).success).toBe(false);
        expect(pageNavFormSchema.safeParse({ page: 3.14 }).success).toBe(false);
      });
    });
  });

  describe('Project Creation Form Schema', () => {
    it('should validate valid project creation payload', async () => {
      const { createProjectFormSchema } = await import('@/features/workspaces/projects/shell/schemas/project.schema');
      const valid = {
        name: 'Quantum Optics',
        identifier: 'QOPT',
        description: 'Research project into cavity QED',
        avatar: '',
        cover: '',
        isPrivate: true,
      };
      const result = createProjectFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Quantum Optics');
        expect(result.data.identifier).toBe('QOPT');
        expect(result.data.isPrivate).toBe(true);
      }
    });

    it('should reject empty name and accept empty identifier for auto-generation', async () => {
      const { createProjectFormSchema } = await import('@/features/workspaces/projects/shell/schemas/project.schema');
      expect(createProjectFormSchema.safeParse({ name: '', identifier: 'QOPT', description: '', avatar: '', cover: '', isPrivate: false }).success).toBe(false);
      expect(createProjectFormSchema.safeParse({ name: 'Valid Project', identifier: '', description: '', avatar: '', cover: '', isPrivate: false }).success).toBe(true);
    });

    it('should reject identifier exceeding 12 characters', async () => {
      const { createProjectFormSchema } = await import('@/features/workspaces/projects/shell/schemas/project.schema');
      const result = createProjectFormSchema.safeParse({ name: 'Valid', identifier: 'TOOLONGIDENTIFIER', description: '', avatar: '', cover: '', isPrivate: false });
      expect(result.success).toBe(false);
    });
  });

  describe('Label Form Schema', () => {
    it('should validate valid label payload with optional description', async () => {
      const { labelFormSchema } = await import('@/features/workspaces/projects/project-id/settings/schemas/label.schema');
      const valid = {
        name: 'High Priority',
        color: '#ef4444',
        description: 'Items requiring immediate turnaround',
        parentId: null,
      };
      const result = labelFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('High Priority');
        expect(result.data.color).toBe('#ef4444');
      }
    });

    it('should reject empty or whitespace-only name', async () => {
      const { labelFormSchema } = await import('@/features/workspaces/projects/project-id/settings/schemas/label.schema');
      const result = labelFormSchema.safeParse({ name: '   ', color: '#3b82f6', description: '', parentId: null });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Label name is required');
      }
    });

    it('should reject name exceeding 255 characters', async () => {
      const { labelFormSchema } = await import('@/features/workspaces/projects/project-id/settings/schemas/label.schema');
      const result = labelFormSchema.safeParse({ name: 'a'.repeat(256), color: '#3b82f6', description: '', parentId: null });
      expect(result.success).toBe(false);
    });
  });

  describe('State Form Schema', () => {
    it('should validate valid state lifecycle payload', async () => {
      const { stateFormSchema } = await import('@/features/workspaces/projects/project-id/settings/schemas/state.schema');
      const valid = {
        name: 'In Review',
        color: '#f59e0b',
        group: 'started' as const,
        description: 'Currently undergoing peer review',
        isDefault: false,
      };
      const result = stateFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.group).toBe('started');
        expect(result.data.isDefault).toBe(false);
      }
    });

    it('should reject empty name or invalid group', async () => {
      const { stateFormSchema } = await import('@/features/workspaces/projects/project-id/settings/schemas/state.schema');
      expect(stateFormSchema.safeParse({ name: '', color: '#fff', group: 'unstarted', description: '', isDefault: false }).success).toBe(false);
      expect(stateFormSchema.safeParse({ name: 'Valid', color: '#fff', group: 'invalid_group' as any, description: '', isDefault: false }).success).toBe(false);
    });
  });

  describe('View Form Schema', () => {
    it('should validate valid project view payload', async () => {
      const { viewFormSchema } = await import('@/features/workspaces/projects/project-id/views/schemas/view.schema');
      const valid = {
        name: 'Sprint Kanban',
        description: 'Board for team sprint',
        layout: 'board' as const,
        access: 'public' as const,
      };
      const result = viewFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.layout).toBe('board');
        expect(result.data.access).toBe('public');
      }
    });

    it('should reject invalid layout or access enum', async () => {
      const { viewFormSchema } = await import('@/features/workspaces/projects/project-id/views/schemas/view.schema');
      expect(viewFormSchema.safeParse({ name: 'View', description: '', layout: 'invalid' as any, access: 'public' }).success).toBe(false);
      expect(viewFormSchema.safeParse({ name: 'View', description: '', layout: 'board', access: 'secret' as any }).success).toBe(false);
    });

    it('should reject empty view name', async () => {
      const { viewFormSchema } = await import('@/features/workspaces/projects/project-id/views/schemas/view.schema');
      const result = viewFormSchema.safeParse({ name: '   ', description: '', layout: 'table', access: 'private' });
      expect(result.success).toBe(false);
    });
  });

  describe('Cycle Form Schema', () => {
    it('should validate valid cycle payload', async () => {
      const { cycleFormSchema } = await import('@/features/workspaces/projects/project-id/cycles/schemas/cycle.schema');
      const valid = {
        name: 'Sprint 2026-Q3',
        description: 'Core platform hardening cycle',
        startDate: '2026-09-01',
        endDate: '2026-09-15',
        phase: 'in_progress',
        status: 'active' as const,
        labels: ['sprint', 'q3'],
      };
      const result = cycleFormSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Sprint 2026-Q3');
        expect(result.data.status).toBe('active');
        expect(result.data.labels).toEqual(['sprint', 'q3']);
      }
    });

    it('should reject empty cycle name', async () => {
      const { cycleFormSchema } = await import('@/features/workspaces/projects/project-id/cycles/schemas/cycle.schema');
      const invalid = {
        name: '   ',
        description: '',
        startDate: '',
        endDate: '',
        phase: 'todo',
        status: 'planned' as const,
        labels: [],
      };
      const result = cycleFormSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Cycle name is required');
      }
    });

    it('should reject invalid cycle status', async () => {
      const { cycleFormSchema } = await import('@/features/workspaces/projects/project-id/cycles/schemas/cycle.schema');
      const invalid = {
        name: 'Cycle 1',
        description: '',
        startDate: '',
        endDate: '',
        phase: 'todo',
        status: 'non_existent_status' as any,
        labels: [],
      };
      expect(cycleFormSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
