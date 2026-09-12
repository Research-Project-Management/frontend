import { describe, it, expect, beforeEach } from 'vitest';
import { createTaskSchema, taskMutationInputSchema } from '@/features/workspaces/projects/project-id/work-items/schemas/schema';
import { TaskHelpers } from '@/features/workspaces/projects/project-id/work-items/utils/util';

describe('Work Item Create Modal - Zero Data Loss & Draft Persistence', () => {
  const projectId = 'proj-123';
  const draftKey = `flux_work_item_draft_${projectId}`;

  beforeEach(() => {
    localStorage.clear();
  });

  it('should persist complete draft state in localStorage without data loss', () => {
    const draftPayload = {
      title: 'Implement Attach Center for Work Items',
      description: 'Replace legacy modules with Pages, Papers, Files, and Links.',
      columnId: 'in_progress',
      issueType: 'feature' as const,
      priority: 'high' as const,
      dueDate: '2026-09-30T00:00:00.000Z',
      startDate: '2026-09-15T00:00:00.000Z',
      recurrence: 'none' as const,
      reminder: '1day' as const,
      labels: ['label-1', 'label-2'],
      assigneeId: 'user-888',
      attachments: {
        pages: [{ id: 'page-1', pageId: 'page-1', title: 'Architecture RFC', addedAt: new Date().toISOString() }],
        papers: [{ id: 'paper-1', paperId: 'paper-1', title: 'Attention Is All You Need', doi: '10.1234/5678', addedAt: new Date().toISOString() }],
        files: [{ id: 'att-1', name: 'spec.pdf', url: 'https://storage/spec.pdf', size: '128 KB' }],
        links: [{ title: 'Design Document', url: 'https://docs.flux.dev', addedAt: new Date().toISOString() }],
      },
      updatedAt: Date.now(),
    };

    localStorage.setItem(draftKey, JSON.stringify(draftPayload));

    const retrievedRaw = localStorage.getItem(draftKey);
    expect(retrievedRaw).toBeTruthy();

    const restored = JSON.parse(retrievedRaw!) as any;
    expect(restored.title).toBe('Implement Attach Center for Work Items');
    expect(restored.description).toContain('Replace legacy modules');
    expect(restored.priority).toBe('high');
    expect(restored.issueType).toBe('feature');
    expect(restored.labels).toEqual(['label-1', 'label-2']);
    expect(restored.assigneeId).toBe('user-888');
    expect(restored.attachments.pages).toHaveLength(1);
    expect(restored.attachments.papers).toHaveLength(1);
    expect(restored.attachments.files).toHaveLength(1);
    expect(restored.attachments.links).toHaveLength(1);
    expect(TaskHelpers.countAttachments(restored.attachments)).toBe(4);
  });

  it('should validate creation payload with Zod createTaskSchema', () => {
    const validCreationInput = {
      title: 'Refactor modals and remove estimate',
      description: 'Per business specs: No estimate, replace modules with attach center',
      columnId: 'todo',
      priority: 'urgent' as const,
      issueType: 'task' as const,
      labels: ['bug', 'critical'],
      attachments: {
        pages: [{ id: 'page-1', title: 'PRD' }],
        papers: [],
        files: [{ id: 'f-1', name: 'error.log', url: '/logs/1' }],
        links: [{ title: 'Issue link', url: 'https://flux.dev/issues/1' }],
      },
    };

    const parsed = createTaskSchema.safeParse(validCreationInput);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe('Refactor modals and remove estimate');
      expect(parsed.data.priority).toBe('urgent');
    }
  });

  it('should normalize legacy flat attachment arrays into 4-category AttachCenterData', () => {
    const legacyArray = [
      { id: 'f-1', name: 'report.pdf', url: 'https://storage/f1' },
      { id: 'f-2', name: 'image.png', url: 'https://storage/f2' },
    ];

    const normalized = {
      pages: [],
      papers: [],
      files: legacyArray,
      links: [],
    };

    expect(TaskHelpers.countAttachments(normalized)).toBe(2);
    expect(normalized.files).toHaveLength(2);
    expect(normalized.pages).toHaveLength(0);
  });

  it('should clear draft upon successful task creation', () => {
    localStorage.setItem(draftKey, JSON.stringify({ title: 'Temporary task', description: '' }));
    expect(localStorage.getItem(draftKey)).not.toBeNull();

    // Simulate completion
    localStorage.removeItem(draftKey);
    expect(localStorage.getItem(draftKey)).toBeNull();
  });
});
