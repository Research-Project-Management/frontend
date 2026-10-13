import { describe, it, expect } from 'vitest';
import {
  yourWorkSummaryResponseSchema,
  yourWorkItemSchema,
  yourWorkActivityEventSchema,
  projectWorkloadBreakdownSchema,
  type YourWorkSummaryResponse,
} from '@/features/projects/your-work/schemas/your-work.schema';
import {
  createProjectMap,
  getWorkItemProjectId,
  getWorkItemProject,
  calculateStatusBreakdown,
  calculatePriorityBreakdown,
} from '@/features/projects/your-work/utils/your-work.util';

describe('YourWork Schema Validation & Integration Tests', () => {
  const mockBackendResponse = {
    projectId: undefined,
    userId: 'user-42',
    assigned: [
      {
        id: 'wi-1',
        identifier: 'FLUX-101',
        title: 'Complete LaTeX compiler optimization',
        columnId: 'in_progress',
        priority: 'urgent',
        dueDate: '2026-10-20T10:00:00.000Z',
        assigneeId: 'user-42',
        authorId: 'user-99',
        projectId: 'proj-1',
        project: {
          id: 'proj-1',
          name: 'Core System',
          identifier: 'FLUX',
          avatar: null,
        },
        comments: [{ id: 'c-1' }],
        commentCount: 1,
        completed: false,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-12T00:00:00.000Z',
      },
    ],
    created: [
      {
        id: 'wi-2',
        identifier: 'FLUX-102',
        title: 'Implement real-time sync telemetry',
        columnId: 'todo',
        priority: 'high',
        dueDate: null,
        assigneeId: null,
        authorId: 'user-42',
        projectId: 'proj-1',
        completed: false,
      },
    ],
    subscribed: [
      {
        id: 'wi-3',
        identifier: 'DOC-5',
        title: 'Review conference submission',
        columnId: 'done',
        priority: 'medium',
        authorId: 'user-88',
        projectId: 'proj-2',
        completed: true,
      },
    ],
    activity: [
      {
        id: 'act-1',
        type: 'work_item_updated',
        actorName: 'You',
        actionVerb: 'updated',
        targetIdentifier: 'FLUX-101',
        targetTitle: 'Complete LaTeX compiler optimization',
        content: 'You updated work_item',
        time: '2026-10-12T12:00:00.000Z',
        itemId: 'wi-1',
        project: {
          id: 'proj-1',
          name: 'Core System',
        },
      },
    ],
    recent: [],
    stateGroupBreakdown: {
      backlog: 0,
      unstarted: 0,
      started: 1,
      completed: 0,
      cancelled: 0,
    },
    subscribedStateGroupBreakdown: {
      backlog: 0,
      unstarted: 0,
      started: 0,
      completed: 1,
      cancelled: 0,
    },
    priorityBreakdown: {
      urgent: 1,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    },
    projectBreakdown: [
      {
        projectId: 'proj-1',
        projectName: 'Core System',
        projectIdentifier: 'FLUX',
        projectAvatar: null,
        assignedCount: 1,
        createdCount: 1,
        subscribedCount: 0,
        totalCount: 2,
        stateGroupBreakdown: {
          backlog: 0,
          unstarted: 0,
          started: 1,
          completed: 0,
          cancelled: 0,
        },
        subscribedStateGroupBreakdown: {
          backlog: 0,
          unstarted: 0,
          started: 0,
          completed: 0,
          cancelled: 0,
        },
        completionRate: 0,
      },
    ],
    userData: {
      id: 'user-42',
      name: 'Alice Turing',
      email: 'alice@flux.dev',
      avatar: 'https://avatar.dev/alice.png',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    isEmpty: false,
    success: true,
  };

  it('should successfully parse complete backend YourWorkSummaryDto', () => {
    const parsed = yourWorkSummaryResponseSchema.safeParse(mockBackendResponse);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const data: YourWorkSummaryResponse = parsed.data;
    expect(data.assigned).toHaveLength(1);
    expect(data.assigned[0].identifier).toBe('FLUX-101');
    expect(data.created).toHaveLength(1);
    expect(data.subscribed).toHaveLength(1);
    expect(data.activity).toHaveLength(1);
    expect(data.userData?.name).toBe('Alice Turing');
    expect(data.projectBreakdown).toHaveLength(1);
    expect(data.projectBreakdown[0].projectName).toBe('Core System');
  });

  it('should handle zeroed empty response gracefully', () => {
    const emptyResponse = {
      assigned: [],
      created: [],
      subscribed: [],
      activity: [],
      recent: [],
      stateGroupBreakdown: {
        backlog: 0,
        unstarted: 0,
        started: 0,
        completed: 0,
        cancelled: 0,
      },
      priorityBreakdown: {
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
        none: 0,
      },
      projectBreakdown: [],
      isEmpty: true,
      success: true,
    };

    const parsed = yourWorkSummaryResponseSchema.safeParse(emptyResponse);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.assigned).toEqual([]);
    expect(parsed.data.isEmpty).toBe(true);
  });
});

describe('YourWork Utilities & Metric Calculators', () => {
  const projects = [
    { id: 'proj-1', name: 'Alpha Project', avatar: '/alpha.png' },
    { id: 'proj-2', name: 'Beta Project', avatar: null },
  ];

  it('should create lookup map correctly', () => {
    const map = createProjectMap(projects);
    expect(map['proj-1']).toEqual({ id: 'proj-1', name: 'Alpha Project', avatar: '/alpha.png' });
    expect(map['proj-2']).toEqual({ id: 'proj-2', name: 'Beta Project', avatar: null });
    expect(map['proj-unknown']).toBeUndefined();
  });

  it('should safely extract projectId across various nested forms', () => {
    expect(getWorkItemProjectId({ projectId: 'p-1' })).toBe('p-1');
    expect(getWorkItemProjectId({ projectId: { id: 'p-2' } })).toBe('p-2');
    expect(getWorkItemProjectId({ project: { id: 'p-3' } })).toBe('p-3');
    expect(getWorkItemProjectId({ project: 'p-4' })).toBe('p-4');
    expect(getWorkItemProjectId(null)).toBeNull();
    expect(getWorkItemProjectId({})).toBeNull();
  });

  it('should resolve project info from map or embedded object', () => {
    const map = createProjectMap(projects);

    // Embedded object has priority
    const itemWithEmbedded = {
      project: { id: 'proj-1', name: 'Alpha Project Overridden', avatar: '/test.png' },
    };
    expect(getWorkItemProject(itemWithEmbedded, map)?.name).toBe('Alpha Project Overridden');

    // Fallback to lookup map
    const itemWithIdOnly = { projectId: 'proj-2' };
    expect(getWorkItemProject(itemWithIdOnly, map)?.name).toBe('Beta Project');
  });

  it('should correctly calculate status breakdown for items', () => {
    const items = [
      { id: '1', title: 'Task 1', columnId: 'todo' },
      { id: '2', title: 'Task 2', columnId: 'in_progress' },
      { id: '3', title: 'Task 3', columnId: 'in_progress' },
      { id: '4', title: 'Task 4', columnId: 'done' },
      { id: '5', title: 'Task 5', columnId: 'backlog' },
    ];

    const breakdown = calculateStatusBreakdown(items as any);
    expect(breakdown.unstarted).toBe(1); // 'todo' maps to unstarted
    expect(breakdown.started).toBe(2);   // 'in_progress' maps to started
    expect(breakdown.completed).toBe(1); // 'done' maps to completed
    expect(breakdown.backlog).toBe(1);   // 'backlog' maps to backlog
  });

  it('should correctly calculate priority breakdown for items', () => {
    const items = [
      { id: '1', title: 'Task 1', priority: 'urgent' },
      { id: '2', title: 'Task 2', priority: 'urgent' },
      { id: '3', title: 'Task 3', priority: 'high' },
      { id: '4', title: 'Task 4', priority: 'medium' },
      { id: '5', title: 'Task 5', priority: 'none' },
    ];

    const breakdown = calculatePriorityBreakdown(items as any);
    expect(breakdown.urgent).toBe(2);
    expect(breakdown.high).toBe(1);
    expect(breakdown.medium).toBe(1);
    expect(breakdown.low).toBe(0);
    expect(breakdown.none).toBe(1);
  });
});
