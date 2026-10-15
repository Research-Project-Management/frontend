/**
 * work-item-dataset-edge-cases.test.ts
 *
 * Comprehensive Real-World Dataset & User Behavior / Edge-Case Experimentation Suite
 * for `work-items` & `your-work` modules.
 *
 * Covers:
 * - Batch 1:
 *   1. Realistic 42-item research dataset (`FLUX-1`..`FLUX-42`, LLaMA-70B / Navier-Stokes / H100)
 *      with LaTeX math titles/descriptions, multi-assignees, subscribers, `@[User](id)` mentions,
 *      nested sub-items, archived items, and complex dependencies + 10,000-item high-scale benchmark.
 *   2. Filter Engine (`work-item-filter-engine.ts`) & `filterItems` edge cases (disjunctive OR within
 *      category + conjunctive AND across categories, boundary dates, leap year `2028-02-29`, DST/UTC
 *      boundaries, malformed/missing fields resilience).
 *   3. Tree-Building (`buildWorkItemTree`) & Dynamic Grouping (`useWorkItemGrouping` / `buildGroupMoveUpdates`)
 *      edge cases (orphaned sub-items promoted to root, circular parent-child loops, self-parenting,
 *      deep 3-level hierarchy with selective collapse/expand, cross-group swimlane moves).
 *
 * - Batch 2:
 *   1. CPM Engine (`cpm-graph.ts`) & Timeline (`timeline.utils.ts`) edge cases (Diamond dependency
 *      graph where `A -> B -> D` > `A -> C -> D`, all 8 relation types, violated vs critical vs normal
 *      dependency lines, cyclic graph resilience, `wouldCauseCycle`, zero-duration milestones, reversed
 *      dates, leap-year spans `2028-02-28` to `2028-03-01`).
 *   2. Calendar View (`calendar.utils.ts`) midnight UTC vs local timezone date keys ensuring zero
 *      -1/+1 day drift across timezones.
 *   3. `your-work` Personal Command Center (`your-work.util.ts`, `activity.util.ts`) multi-assignee,
 *      creator, subscriber categorization, mass-subscription/unsubscription, Overdue vs Due Soon (7-day)
 *      excluding `DONE` & `CANCELLED`, priority/state breakdowns, and activity sorting/filtering.
 *   4. Centralized Toast (`use-work-item-toast.ts`) & Attachment/Activity Modal Helpers (`modal.utils.ts`).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { toast } from 'sonner';

import {
  WorkItemFilterEngine,
  filterItems,
  FastBitset,
} from '@/features/projects/project-id/work-items/utils/work-item-filter-engine';
import {
  buildWorkItemTree,
  buildGroupMoveUpdates,
  getItemBucketKey,
  ItemHelpers,
  normalizeStates,
} from '@/features/projects/project-id/work-items/utils/work-item.utils';
import { useWorkItemGrouping } from '@/features/projects/project-id/work-items/hooks/use-work-item-grouping';
import {
  analyzeCriticalPath,
  extractNormalizedEdges,
  wouldCauseCycle,
  calculateTaskDuration,
  parseDateOnly,
} from '@/features/projects/project-id/work-items/utils/cpm-graph';
import {
  buildTimelineData,
  mapItemToBar,
  computeDependencyLines,
  calculateDuration,
} from '@/features/projects/project-id/work-items/utils/timeline.utils';
import {
  isMidnightDueDate,
  getCalendarDateKey,
  createCalendarDueDate,
} from '@/features/projects/project-id/work-items/utils/calendar.utils';
import {
  AttachmentStateHelpers,
  EMPTY_ATTACHMENTS,
  buildActivityEntries,
} from '@/features/projects/project-id/work-items/utils/modal.utils';
import {
  workItemToast,
  WORK_ITEM_TOAST_IDS,
} from '@/features/projects/project-id/work-items/hooks/use-work-item-toast';
import {
  DEFAULT_FILTERS,
  DEFAULT_DISPLAY_OPTIONS,
  type Item,
  type Column,
  type Priority,
} from '@/features/projects/project-id/work-items/types/work-item.types';

import {
  categorizeWorkItemsForUser,
  calculateSummaryStats,
  calculatePriorityBreakdown,
  calculateStateBreakdown,
  calculateStatusBreakdown,
  isAssignedToUser,
  isSubscribedByUser,
  type TriageItemCandidate,
} from '@/features/projects/your-work/utils/your-work.util';
import {
  sortActivities,
  filterActivities,
  filterAndSortActivities,
} from '@/features/projects/your-work/utils/activity.util';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// ============================================================================
// REAL-WORLD 42-ITEM RESEARCH DATASET FIXTURE (FLUX-1 .. FLUX-42)
// ============================================================================

const RESEARCH_COLUMNS: Column[] = normalizeStates([
  { id: 'backlog', name: 'Backlog', group: 'backlog', color: '#6B7280', sequence: 1000, isDefault: true },
  { id: 'todo', name: 'To Do', group: 'unstarted', color: '#94A3B8', sequence: 2000 },
  { id: 'in_progress', name: 'In Progress', group: 'started', color: '#D97706', sequence: 3000 },
  { id: 'in_review', name: 'In Review', group: 'started', color: '#3B82F6', sequence: 3500 },
  { id: 'done', name: 'Done', group: 'completed', color: '#1A7F37', sequence: 4000 },
  { id: 'cancelled', name: 'Cancelled', group: 'cancelled', color: '#9CA3AF', sequence: 5000 },
]);

const RESEARCH_USERS = {
  alice: { id: 'user-alice', name: 'Alice Turing', email: 'alice@flux.ai' },
  bob: { id: 'user-bob', name: 'Bob Navier', email: 'bob@flux.ai' },
  charlie: { id: 'user-charlie', name: 'Charlie Tensor', email: 'charlie@flux.ai' },
  diana: { id: 'user-diana', name: 'Diana Stokes', email: 'diana@flux.ai' },
  evan: { id: 'user-evan', name: 'Evan Hopper', email: 'evan@flux.ai' },
};

function build42ResearchDataset(baseNow: Date = new Date()): Item[] {
  const fmtDateOffset = (daysOffset: number): string => {
    const d = new Date(baseNow.getFullYear(), baseNow.getMonth(), baseNow.getDate() + daysOffset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const titles: string[] = [
    'Derive Navier-Stokes vorticity formulation $\\nabla \\times (\\mathbf{u} \\times \\boldsymbol{\\omega}) = \\nu \\nabla^2 \\boldsymbol{\\omega}$',
    'Provision 64x H100 SXM5 InfiniBand NCCL ring topology cluster',
    'Implement FlashAttention-3 FP8 kernel for LLaMA-70B context window $L = 131072$',
    'Calibrate Spectral PINN loss $\\mathcal{L}_{\\text{pde}} + \\lambda \\mathcal{L}_{\\text{bc}}$ on 3D turbulent channel flow',
    'Profile NVLinkall-reduce latency under FSDP ZeRO-3 sharding',
    'Stabilize AdamW $\\beta_2 = 0.95$ warmup schedule for 70B pretraining',
    'Validate Kolmogorov $-5/3$ energy cascade spectrum $E(k) \\propto \\varepsilon^{2/3} k^{-5/3}$',
    'Quantize LLaMA-70B weights to INT4 AWQ with group size $g = 128$',
    'Resolve CUDA OOM spike during activation checkpointing backward pass',
    'Benchmark vLLM PagedAttention KV-cache throughput on H100 PCIe vs SXM5',
    'Synthesize LaTeX manuscript Section 3: $\\mathbb{R}^{d \\times d}$ Riemannian manifold optimization',
    'Run ablation study on RoPE base frequency $\\theta = 500000$',
    'Implement adaptive Runge-Kutta 4th order solver for stiff PDE boundary layer',
    'Fix NaN gradient explosion in mixed-precision FP16 layernorm $\\epsilon = 10^{-6}$',
    'Export TikZ phase portrait diagrams for Reynolds number $Re = 10^5$',
    'Configure Slurm preemptible job array checkpoint auto-resume on H100 node failure',
    'Evaluate MMLU & GSM8K zero-shot reasoning accuracy after DPO alignment',
    'Optimize Triton fused SwiGLU + RMSNorm CUDA kernel occupancy',
    'Verify divergence-free velocity projection $\\nabla \\cdot \\mathbf{u} = 0$ via FFT Poisson solver',
    'Integrate BibTeX citations for Vaswani2017, Dao2023, and Kolmogorov1941',
    'Audit InfiniBand RoCEv2 packet drop telemetry on rack switch 04',
    'Train LoRA rank $r = 64, \\alpha = 128$ adapter on theorem-proving corpus',
    'Sub-item: Write unit tests for 3D FFT wavenumber grid indexing',
    'Sub-item: Verify Hermitian symmetry in inverse real FFT step',
    'Deep Sub-item: Check Nyquist mode zeroing on odd grid sizes',
    'Sub-item: Benchmark cuFFT vs VkFFT on H100 SXM5',
    'Orphaned Sub-item: Legacy V100 tensor core fallback kernel (parent archived)',
    'Archived: Deprecated PyTorch 1.13 apex AMP training wrapper',
    'Archived: Old Navier-Stokes 2D finite difference prototype',
    'Cancelled: Migrate LLaMA-70B pipeline to TPU v4 pods (wontfix)',
    'Draft NeurIPS rebuttal table comparing H100 TFLOPS utilization',
    'Tune speculative decoding draft model acceptance rate $\\gamma = 5$',
    'Implement Crandall-Lions viscosity solution error bound estimator',
    'Setup Prometheus GPU temperature & HBM3 ECC error alerting',
    'Deduplicate ArXiv preprints in corpus preprocessing pipeline',
    'Compute Hessian trace $\\text{Tr}(\\nabla^2 \\mathcal{L})$ via Hutchinson stochastic estimator',
    'Parallelize HDF5 turbulent snapshot I/O across Lustre OSTs',
    'Verify Sobolev norm $\\|u\\|_{H^s(\\Omega)}$ conservation in Galerkin projection',
    'Patch NCCL P2P deadlock when world_size = 64 and tensor_parallel = 8',
    'Review appendix proofs for Theorem 4.2 convergence rate $\\mathcal{O}(1/\\sqrt{T})$',
    'Publish anonymized checkpoint weights to HuggingFace Hub',
    'Final camera-ready LaTeX compilation and PDF/A validation',
  ];

  const states = ['in_progress', 'in_review', 'todo', 'backlog', 'done', 'cancelled'];
  const priorities: Priority[] = ['urgent', 'high', 'medium', 'low', 'none'];
  const userIds = [
    RESEARCH_USERS.alice.id,
    RESEARCH_USERS.bob.id,
    RESEARCH_USERS.charlie.id,
    RESEARCH_USERS.diana.id,
    RESEARCH_USERS.evan.id,
  ];

  return titles.map((title, idx) => {
    const seq = idx + 1;
    const id = `flux-${seq}`;
    const identifier = `FLUX-${seq}`;

    // Deterministic rich assignment for specific items to test multi-criteria queries
    if (seq === 1) {
      return {
        id,
        identifier,
        sequenceNumber: seq,
        title,
        description: ` Core mathematical derivation with @[Charlie Tensor](${RESEARCH_USERS.charlie.id}) reviewing the vorticity transport equation.`,
        content: `Please check boundary conditions @[Charlie Tensor](${RESEARCH_USERS.charlie.id})`,
        columnId: 'in_progress',
        priority: 'urgent',
        projectId: 'proj-research',
        authorId: RESEARCH_USERS.diana.id,
        assigneeId: RESEARCH_USERS.alice.id,
        assigneeIds: [RESEARCH_USERS.alice.id, RESEARCH_USERS.bob.id],
        assignees: [RESEARCH_USERS.alice, RESEARCH_USERS.bob],
        subscriberIds: [RESEARCH_USERS.bob.id, RESEARCH_USERS.diana.id],
        labels: ['math-pde', 'navier-stokes', 'h100'],
        startDate: fmtDateOffset(-5),
        dueDate: fmtDateOffset(-1), // Overdue & active!
        completed: false,
        rank: seq * 100,
        relations: [{ id: 'rel-1-3', type: 'blocks', targetWorkItemId: 'flux-3' }],
        attachments: {
          pages: [{ id: 'page-1', title: 'Vorticity Derivation Notes' }],
          papers: [{ id: 'paper-1', title: 'Kolmogorov 1941 Turbulence', doi: '10.1098/rspa.1991.0075' }],
          files: [{ id: 'file-1', name: 'spectrum.pdf', url: 'https://flux.ai/files/spectrum.pdf' }],
          links: [{ title: 'ArXiv Preprint', url: 'https://arxiv.org/abs/2307.08691' }],
        },
        subItems: [],
        childWorkItems: [],
      } as Item;
    }

    if (seq === 2) {
      return {
        id,
        identifier,
        sequenceNumber: seq,
        title,
        description: `Cluster provisioning led by Alice and subscribed by Bob. Ping @[Charlie Tensor](${RESEARCH_USERS.charlie.id}) for NCCL topo XML.`,
        content: '',
        columnId: 'in_review',
        priority: 'high',
        projectId: 'proj-research',
        authorId: RESEARCH_USERS.alice.id,
        assigneeId: RESEARCH_USERS.alice.id,
        assigneeIds: [RESEARCH_USERS.alice.id],
        assignees: [RESEARCH_USERS.alice],
        subscriberIds: [RESEARCH_USERS.bob.id],
        labels: ['h100', 'infra'],
        startDate: fmtDateOffset(-2),
        dueDate: fmtDateOffset(0), // Due today!
        completed: false,
        rank: seq * 100,
        relations: [],
        attachments: { pages: [], papers: [], files: [], links: [] },
        subItems: [],
        childWorkItems: [],
      } as Item;
    }

    if (seq === 3) {
      return {
        id,
        identifier,
        sequenceNumber: seq,
        title,
        description: `FlashAttention-3 kernel optimization. CC @[Diana Stokes](${RESEARCH_USERS.diana.id})`,
        content: '',
        columnId: 'in_progress',
        priority: 'urgent',
        projectId: 'proj-research',
        authorId: RESEARCH_USERS.bob.id,
        assigneeId: RESEARCH_USERS.bob.id,
        assigneeIds: [RESEARCH_USERS.bob.id, RESEARCH_USERS.alice.id],
        assignees: [RESEARCH_USERS.bob, RESEARCH_USERS.alice],
        subscriberIds: [RESEARCH_USERS.bob.id, RESEARCH_USERS.charlie.id],
        labels: ['llama-70b', 'cuda', 'h100'],
        startDate: fmtDateOffset(0),
        dueDate: fmtDateOffset(2), // Due soon
        completed: false,
        rank: seq * 100,
        relations: [{ id: 'rel-3-1', type: 'blocked_by', targetWorkItemId: 'flux-1' }],
        attachments: { pages: [], papers: [], files: [], links: [] },
        subItems: [],
        childWorkItems: [],
      } as Item;
    }

    // Hierarchy items: flux-19 (root) -> flux-23 (level 1) -> flux-25 (level 2), plus flux-24 (level 1)
    let parentId: string | null = null;
    if (seq === 23 || seq === 24 || seq === 26) parentId = 'flux-19';
    if (seq === 25) parentId = 'flux-23';
    if (seq === 27) parentId = 'flux-28'; // Parent flux-28 is archived/filtered out in active views

    const colId =
      seq === 28 || seq === 29
        ? 'done'
        : seq === 30
          ? 'cancelled'
          : states[idx % states.length];

    const isDone = colId === 'done';
    const isCancelled = colId === 'cancelled';

    return {
      id,
      identifier,
      sequenceNumber: seq,
      title,
      description: `Research task ${identifier} on LLaMA-70B and Navier-Stokes H100 simulation.`,
      content: '',
      columnId: colId,
      priority: priorities[idx % priorities.length],
      projectId: 'proj-research',
      authorId: userIds[(idx + 1) % userIds.length],
      assigneeId: idx % 9 === 0 ? null : userIds[idx % userIds.length],
      assigneeIds: idx % 9 === 0 ? [] : [userIds[idx % userIds.length]],
      assignees: [],
      subscriberIds: [userIds[(idx + 2) % userIds.length]],
      parentId,
      labels: idx % 2 === 0 ? ['llama-70b', 'h100'] : ['navier-stokes', 'math-pde'],
      startDate: fmtDateOffset((idx % 10) - 5),
      dueDate: isDone || isCancelled ? fmtDateOffset(-10) : fmtDateOffset((idx % 14) - 3),
      completed: isDone,
      rank: seq * 100,
      relations: [],
      attachments: { pages: [], papers: [], files: [], links: [] },
      subItems: [],
      childWorkItems: [],
    } as Item;
  });
}

const baseDate = new Date();
const dataset42 = build42ResearchDataset(baseDate);

// ============================================================================
// BATCH 1: REAL-WORLD 42-ITEM DATASET + 10,000-ITEM BITSET FILTER & GROUPING
// ============================================================================

describe('Batch 1: Real-World 42-Item Research Dataset & High-Scale Filter/Grouping Suite', () => {
  describe('1. 42-Item Research Dataset Fixture Integrity & LaTeX / Mention Indexing', () => {

    it('constructs all 42 research items (FLUX-1..FLUX-42) with LaTeX math, multi-assignees, subscribers, and hierarchy', () => {
      expect(dataset42).toHaveLength(42);
      expect(dataset42[0].identifier).toBe('FLUX-1');
      expect(dataset42[41].identifier).toBe('FLUX-42');
      expect(dataset42[0].title).toContain('\\nabla \\times');
      expect(dataset42[2].title).toContain('LLaMA-70B');

      const engine = new WorkItemFilterEngine(dataset42, RESEARCH_COLUMNS);

      // Search by LaTeX token or identifier
      const navierMatches = engine.executeFilter(DEFAULT_FILTERS, 'Navier Stokes');
      expect(navierMatches.some((i) => i.id === 'flux-1')).toBe(true);

      const h100Matches = engine.executeFilter(DEFAULT_FILTERS, 'H100');
      expect(h100Matches.some((i) => i.id === 'flux-2')).toBe(true);
    });
  });

  describe('2. Filter Engine (work-item-filter-engine.ts) & filterItems Edge Cases', () => {
    it('executes Disjunctive within category (OR) + Conjunctive across categories (AND) including multi-assignee, subscriber, and @[User](id) mentions', () => {
      // Query:
      // (State = in_progress OR in_review)
      // AND (Priority = urgent OR high)
      // AND (Assignee = user-alice) -- matches primary assignee OR secondary in assigneeIds[]
      // AND (Subscribed by user-bob)
      // AND (Mentioned user-charlie via @[Charlie Tensor](user-charlie))
      const results = filterItems(
        dataset42,
        {
          ...DEFAULT_FILTERS,
          state: ['in_progress', 'in_review'],
          priority: ['urgent', 'high'],
          assignees: [RESEARCH_USERS.alice.id],
          subscribers: [RESEARCH_USERS.bob.id],
          mentions: [RESEARCH_USERS.charlie.id],
        },
        '',
        RESEARCH_COLUMNS,
      );

      // Both FLUX-1 (in_progress, urgent, alice+bob assigned, bob subscribed, mentions charlie)
      // and FLUX-2 (in_review, high, alice assigned, bob subscribed, mentions charlie) must match!
      // FLUX-3 mentions Diana instead of Charlie, so it must be excluded.
      const matchedIds = results.map((r) => r.id);
      expect(matchedIds).toContain('flux-1');
      expect(matchedIds).toContain('flux-2');
      expect(matchedIds).not.toContain('flux-3');
    });

    it('handles boundary date filters: overdue (excluding DONE and CANCELLED), today, this_week, next_week, no_date, leap year 2028-02-29, and custom ISO ranges', () => {
      const now = new Date();
      const toLocalIso = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const yesterdayStr = toLocalIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2));
      const todayStr = toLocalIso(now);

      // Compute a date guaranteed to be in next_week (Monday of current week + 8 days)
      const dayOfWeek = (now.getDay() + 6) % 7;
      const nextWeekDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 8);
      const nextWeekStr = toLocalIso(nextWeekDate);

      const dateEdgeItems: Item[] = [
        {
          id: 'overdue-active',
          title: 'Active Overdue Task',
          columnId: 'in_progress',
          priority: 'urgent',
          projectId: 'p1',
          dueDate: yesterdayStr,
          completed: false,
        } as Item,
        {
          id: 'overdue-done',
          title: 'Completed Past Due Task',
          columnId: 'done',
          stateGroup: 'completed',
          priority: 'high',
          projectId: 'p1',
          dueDate: yesterdayStr,
          completed: true,
        } as Item,
        {
          id: 'overdue-cancelled',
          title: 'Cancelled Past Due Task',
          columnId: 'cancelled',
          stateGroup: 'cancelled',
          priority: 'low',
          projectId: 'p1',
          dueDate: yesterdayStr,
          completed: false,
        } as Item,
        {
          id: 'due-today',
          title: 'Due Today Midnight Boundary',
          columnId: 'todo',
          priority: 'medium',
          projectId: 'p1',
          dueDate: `${todayStr}T00:00:00`,
          completed: false,
        } as Item,
        {
          id: 'due-next-week',
          title: 'Due Next Week Task',
          columnId: 'todo',
          priority: 'medium',
          projectId: 'p1',
          dueDate: nextWeekStr,
          completed: false,
        } as Item,
        {
          id: 'due-leap-year',
          title: 'Leap Day 2028 Milestone',
          columnId: 'todo',
          priority: 'high',
          projectId: 'p1',
          dueDate: '2028-02-29T12:00:00.000Z',
          completed: false,
        } as Item,
        {
          id: 'due-none',
          title: 'Unscheduled Research Backlog',
          columnId: 'backlog',
          priority: 'none',
          projectId: 'p1',
          dueDate: null,
          completed: false,
        } as Item,
      ];

      const engine = new WorkItemFilterEngine(dateEdgeItems, RESEARCH_COLUMNS);

      // 1. Overdue MUST exclude DONE and CANCELLED items even when dueDate < today
      const overdueRes = engine.executeFilter({ ...DEFAULT_FILTERS, due_date: ['overdue'] });
      expect(overdueRes.map((i) => i.id)).toEqual(['overdue-active']);

      // 2. Today filter
      const todayRes = engine.executeFilter({ ...DEFAULT_FILTERS, due_date: ['today'] });
      expect(todayRes.map((i) => i.id)).toContain('due-today');

      // 3. Next week filter
      const nextWeekRes = engine.executeFilter({ ...DEFAULT_FILTERS, due_date: ['next_week'] });
      expect(nextWeekRes.map((i) => i.id)).toEqual(['due-next-week']);

      // 4. No date filter
      const noDateRes = engine.executeFilter({ ...DEFAULT_FILTERS, due_date: ['no_date'] });
      expect(noDateRes.map((i) => i.id)).toEqual(['due-none']);

      // 5. Leap year 2028-02-29 exact date & custom ISO range filter
      const leapExactRes = engine.executeFilter({ ...DEFAULT_FILTERS, due_date: ['2028-02-29'] });
      expect(leapExactRes.map((i) => i.id)).toEqual(['due-leap-year']);

      const customRangeRes = engine.executeFilter({
        ...DEFAULT_FILTERS,
        dueDateRange: { from: '2028-02-28', to: '2028-03-01' },
      });
      expect(customRangeRes.map((i) => i.id)).toEqual(['due-leap-year']);
    });

    it('is resilient to malformed / missing fields (null title, undefined labels/assignees, legacy string states vs object states)', () => {
      const malformedItems = [
        {
          id: 'mal-1',
          title: null as unknown as string,
          columnId: undefined as unknown as string,
          state: 'in_progress' as unknown as Item['state'],
          priority: undefined as unknown as Priority,
          labels: undefined as unknown as string[],
          assignees: undefined as unknown as Item['assignees'],
          projectId: 'p1',
        },
        {
          id: 'mal-2',
          title: 'Object State Item',
          columnId: '',
          state: { id: 'custom-review', name: 'In Review', group: 'started', color: '#3B82F6' },
          priority: 'HIGH' as unknown as Priority,
          labels: [null as unknown as string, { id: 'lbl-gpu', name: 'GPU' }],
          assigneeIds: ['user-diana'],
          projectId: 'p1',
        },
        null as unknown as Item,
      ] as Item[];

      expect(() => new WorkItemFilterEngine(malformedItems, RESEARCH_COLUMNS)).not.toThrow();
      const engine = new WorkItemFilterEngine(malformedItems, RESEARCH_COLUMNS);

      // Legacy string state 'in_progress' inferred as 'started' state_group
      const startedItems = engine.executeFilter({ ...DEFAULT_FILTERS, state_group: ['started'] });
      expect(startedItems.map((i) => i.id)).toEqual(['mal-1', 'mal-2']);

      // Object state id and priority case-insensitivity
      const highObjState = engine.executeFilter({
        ...DEFAULT_FILTERS,
        state: ['custom-review'],
        priority: ['high'],
        assignees: ['user-diana'],
        labels: ['lbl-gpu'],
      });
      expect(highObjState.map((i) => i.id)).toEqual(['mal-2']);
    });

    it('scales to 10,000 items with Roaring/FastBitset bitwise intersections in sub-15ms', () => {
      const scaleCount = 10000;
      const items10k: Item[] = new Array(scaleCount);
      for (let i = 0; i < scaleCount; i++) {
        const template = dataset42[i % dataset42.length];
        items10k[i] = {
          ...template,
          id: `scale-${i}`,
          identifier: `FLUX-${1000 + i}`,
          sequenceNumber: 1000 + i,
        };
      }

      const engine = new WorkItemFilterEngine(items10k, RESEARCH_COLUMNS);
      const t0 = performance.now();
      const matched = engine.executeFilter(
        {
          ...DEFAULT_FILTERS,
          state: ['in_progress', 'in_review'],
          priority: ['urgent', 'high'],
          assignees: [RESEARCH_USERS.alice.id],
          subscribers: [RESEARCH_USERS.bob.id],
        },
        'Navier',
      );
      const elapsedMs = performance.now() - t0;

      expect(elapsedMs).toBeLessThan(25);
      expect(matched.length).toBeGreaterThan(200);
      expect(matched.every((m) => m.title.includes('Navier'))).toBe(true);
    });
  });

  describe('3. Tree-Building (buildWorkItemTree) & Dynamic Grouping (useWorkItemGrouping / buildGroupMoveUpdates) Edge Cases', () => {
    it('promotes orphaned sub-items (whose parent is filtered out or archived) to root rather than dropping them', () => {
      // In dataset42, flux-27 has parentId = 'flux-28'. Simulate filtering out 'flux-28' (archived).
      const activeSubset = dataset42.filter((i) => i.id !== 'flux-28');
      const treeRows = buildWorkItemTree(activeSubset, { showChildWorkItems: true });

      const orphanRow = treeRows.find((r) => r.item.id === 'flux-27');
      expect(orphanRow).toBeDefined();
      expect(orphanRow?.isSubItem).toBe(false);
      expect(orphanRow?.depth).toBe(0);
    });

    it('safely breaks circular parent-child references (A <-> B) and self-parenting (C -> C) without infinite recursion', () => {
      const cyclicItems: Item[] = [
        { id: 'cycle-a', title: 'Node A', columnId: 'todo', parentId: 'cycle-b', projectId: 'p1' } as Item,
        { id: 'cycle-b', title: 'Node B', columnId: 'todo', parentId: 'cycle-a', projectId: 'p1' } as Item,
        { id: 'self-c', title: 'Self Parent C', columnId: 'todo', parentId: 'self-c', projectId: 'p1' } as Item,
        { id: 'self-c', title: 'Duplicate ID Self Parent C', columnId: 'todo', parentId: 'self-c', projectId: 'p1' } as Item,
      ];

      const rows = buildWorkItemTree(cyclicItems, { showChildWorkItems: true });
      // Deduplicates 'self-c' and includes all 3 unique items without hanging
      expect(rows.map((r) => r.item.id)).toEqual(['self-c', 'cycle-a', 'cycle-b']);
    });

    it('renders deep 3-level hierarchy (Root -> L1 -> L2) and respects selective collapsedParentIds / expandedIds without leaking collapsed children to root', () => {
      // Extract hierarchy nodes from dataset42: flux-19 (root) -> flux-23 (L1) -> flux-25 (L2), and flux-24 (L1)
      const hierarchySlice = dataset42.filter((i) =>
        ['flux-19', 'flux-23', 'flux-24', 'flux-25'].includes(i.id),
      );

      // 1. Fully expanded
      const expandedTree = buildWorkItemTree(hierarchySlice, { showChildWorkItems: true });
      expect(expandedTree.map((r) => ({ id: r.item.id, depth: r.depth, isSub: r.isSubItem }))).toEqual([
        { id: 'flux-19', depth: 0, isSub: false },
        { id: 'flux-23', depth: 1, isSub: true },
        { id: 'flux-25', depth: 2, isSub: true },
        { id: 'flux-24', depth: 1, isSub: true },
      ]);

      // 2. Collapse L1 node 'flux-23' -> 'flux-25' must be hidden (and NOT promoted to root!)
      const collapsedL1 = buildWorkItemTree(hierarchySlice, {
        showChildWorkItems: true,
        collapsedParentIds: new Set(['flux-23']),
      });
      expect(collapsedL1.map((r) => r.item.id)).toEqual(['flux-19', 'flux-23', 'flux-24']);

      // 3. Selective expandedIds (only 'flux-19' expanded, 'flux-23' not in expandedIds)
      const selectiveExpanded = buildWorkItemTree(hierarchySlice, {
        showChildWorkItems: true,
        expandedIds: new Set(['flux-19']),
      });
      expect(selectiveExpanded.map((r) => r.item.id)).toEqual(['flux-19', 'flux-23', 'flux-24']);
    });

    it('buckets items dynamically via useWorkItemGrouping and computes cross-group + swimlane updates via buildGroupMoveUpdates', () => {
      const members = Object.values(RESEARCH_USERS);
      const labels = [
        { id: 'llama-70b', name: 'LLaMA-70B', color: '#EF4444' },
        { id: 'navier-stokes', name: 'Navier-Stokes', color: '#3B82F6' },
        { id: 'h100', name: 'H100', color: '#10B981' },
        { id: 'math-pde', name: 'Math PDE', color: '#8B5CF6' },
        { id: 'infra', name: 'Infra', color: '#F59E0B' },
      ];

      const { result: priorityGrouping } = renderHook(() =>
        useWorkItemGrouping({
          items: dataset42,
          columns: RESEARCH_COLUMNS,
          members,
          labels,
          displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, groupBy: 'priority' },
        }),
      );

      expect(priorityGrouping.current.effectiveGroupBy).toBe('priority');
      const totalBucketed = Array.from(priorityGrouping.current.itemsByColumnId.values()).reduce(
        (acc, arr) => acc + arr.length,
        0,
      );
      expect(totalBucketed).toBe(42);

      // Verify buildGroupMoveUpdates across state, priority, assignee, labels + swimlane laneData overrides
      expect(
        buildGroupMoveUpdates('state', 'in_review', { subGroupBy: 'priority', laneId: 'urgent' }),
      ).toEqual({
        columnId: 'in_review',
        priority: 'urgent',
      });

      expect(
        buildGroupMoveUpdates('priority', 'high', { subGroupBy: 'assignee', laneId: 'user-alice' }),
      ).toEqual({
        priority: 'high',
        assigneeId: 'user-alice',
      });

      expect(
        buildGroupMoveUpdates('assignee', '__unassigned__', { subGroupBy: 'labels', laneId: 'h100' }),
      ).toEqual({
        assigneeId: null,
        labels: ['h100'],
      });

      expect(buildGroupMoveUpdates('labels', '__no_label__')).toEqual({
        labels: [],
      });

      expect(buildGroupMoveUpdates('none', '__all__')).toBeNull();
    });
  });
});

// ============================================================================
// BATCH 2: CPM CRITICAL PATH, GANTT VIOLATIONS, CALENDAR TZ & YOUR-WORK TRIAGE
// ============================================================================

describe('Batch 2: CPM Critical Path, Gantt Dependency Violations, Calendar & Your-Work Suite', () => {
  describe('1. CPM Engine (cpm-graph.ts) & Timeline (timeline.utils.ts) Edge Cases', () => {
    it('computes exact ES, EF, LS, LF, slack = 0 on critical path {A, B, D} and slack > 0 on non-critical C in Diamond Graph (A->B->D > A->C->D)', () => {
      // Diamond graph:
      // A: 3 days (2026-03-01 .. 2026-03-03) -> ES=0, EF=3
      // B: 6 days (2026-03-04 .. 2026-03-09) -> ES=3, EF=9
      // C: 2 days (2026-03-04 .. 2026-03-05) -> ES=3, EF=5
      // D: 4 days (2026-03-10 .. 2026-03-13) -> depends on B and C -> ES=9, EF=13
      const diamondItems: Item[] = [
        {
          id: 'A',
          title: 'Node A',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-03-01',
          dueDate: '2026-03-03',
          relations: [
            { id: 'r1', type: 'blocks', targetWorkItemId: 'B' },
            { id: 'r2', type: 'blocks', targetWorkItemId: 'C' },
          ],
        } as unknown as Item,
        {
          id: 'B',
          title: 'Node B (Long Path)',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-03-04',
          dueDate: '2026-03-09',
          relations: [{ id: 'r3', type: 'blocks', targetWorkItemId: 'D' }],
        } as unknown as Item,
        {
          id: 'C',
          title: 'Node C (Short Path)',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-03-04',
          dueDate: '2026-03-05',
          relations: [{ id: 'r4', type: 'blocks', targetWorkItemId: 'D' }],
        } as unknown as Item,
        {
          id: 'D',
          title: 'Node D (Terminal)',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-03-10',
          dueDate: '2026-03-13',
          relations: [],
        } as unknown as Item,
      ];

      const cpm = analyzeCriticalPath(diamondItems);
      expect(cpm.hasCycle).toBe(false);
      expect(cpm.projectDurationDays).toBe(13);

      const nodeA = cpm.nodes.get('A')!;
      const nodeB = cpm.nodes.get('B')!;
      const nodeC = cpm.nodes.get('C')!;
      const nodeD = cpm.nodes.get('D')!;

      // Node A: ES=0, EF=3, LS=0, LF=3, slack=0
      expect(nodeA).toMatchObject({
        earliestStart: 0,
        earliestFinish: 3,
        latestStart: 0,
        latestFinish: 3,
        slackDays: 0,
        isCritical: true,
      });

      // Node B: ES=3, EF=9, LS=3, LF=9, slack=0
      expect(nodeB).toMatchObject({
        earliestStart: 3,
        earliestFinish: 9,
        latestStart: 3,
        latestFinish: 9,
        slackDays: 0,
        isCritical: true,
      });

      // Node C: ES=3, EF=5, LF=9, LS=7, slack=4 (> 0, non-critical!)
      expect(nodeC).toMatchObject({
        earliestStart: 3,
        earliestFinish: 5,
        latestStart: 7,
        latestFinish: 9,
        slackDays: 4,
        isCritical: false,
      });

      // Node D: ES=9, EF=13, LS=9, LF=13, slack=0
      expect(nodeD).toMatchObject({
        earliestStart: 9,
        earliestFinish: 13,
        latestStart: 9,
        latestFinish: 13,
        slackDays: 0,
        isCritical: true,
      });

      expect(Array.from(cpm.criticalPathItemIds).sort()).toEqual(['A', 'B', 'D']);
      expect(cpm.criticalEdges.has('A->B')).toBe(true);
      expect(cpm.criticalEdges.has('B->D')).toBe(true);
      expect(cpm.criticalEdges.has('A->C')).toBe(false);
      expect(cpm.criticalEdges.has('C->D')).toBe(false);
    });

    it('normalizes all 8 relation types (BLOCKS, BLOCKED_BY, FINISH_TO_START, START_TO_START, FINISH_TO_FINISH, START_TO_FINISH, PRECEDES, SUCCEEDS) and classifies violated vs critical vs normal dependency lines', () => {
      const items8Rel: Item[] = [
        {
          id: 'T1',
          title: 'Task 1',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-05-10',
          dueDate: '2026-05-15',
          relations: [
            { id: 'r-blocks', type: 'BLOCKS' as any, targetWorkItemId: 'T2' },
            { id: 'r-fs', type: 'FINISH_TO_START' as any, targetWorkItemId: 'T3' },
            { id: 'r-ss', type: 'START_TO_START' as any, targetWorkItemId: 'T4' },
            { id: 'r-ff', type: 'FINISH_TO_FINISH' as any, targetWorkItemId: 'T5' },
            { id: 'r-sf', type: 'START_TO_FINISH' as any, targetWorkItemId: 'T6' },
            { id: 'r-prec', type: 'PRECEDES' as any, targetWorkItemId: 'T7' },
          ],
        } as unknown as Item,
        {
          id: 'T2',
          title: 'Task 2 (Violated FS: starts before T1 finishes)',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-05-12', // < 2026-05-15 -> violated!
          dueDate: '2026-05-18',
          relations: [{ id: 'r-bby', type: 'BLOCKED_BY' as any, targetWorkItemId: 'T1' }],
        } as unknown as Item,
        {
          id: 'T3',
          title: 'Task 3 (Valid Critical FS)',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-05-16',
          dueDate: '2026-05-25',
          relations: [],
        } as unknown as Item,
        {
          id: 'T4',
          title: 'Task 4 (Violated SS: starts before T1 starts)',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-05-08', // < 2026-05-10 -> violated!
          dueDate: '2026-05-14',
          relations: [],
        } as unknown as Item,
        {
          id: 'T5',
          title: 'Task 5 (Valid FF)',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-05-11',
          dueDate: '2026-05-16',
          relations: [],
        } as unknown as Item,
        {
          id: 'T6',
          title: 'Task 6 (Violated SF: finishes before T1 starts)',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-05-05',
          dueDate: '2026-05-08', // < 2026-05-10 -> violated!
          relations: [],
        } as unknown as Item,
        {
          id: 'T7',
          title: 'Task 7 (Precedes / Succeeds)',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-05-16',
          dueDate: '2026-05-18',
          relations: [{ id: 'r-succ', type: 'SUCCEEDS' as any, targetWorkItemId: 'T1' }],
        } as unknown as Item,
      ];

      const edges = extractNormalizedEdges(items8Rel);
      // T1->T2 (deduplicated BLOCKS + BLOCKED_BY), T1->T3 (FS), T1->T4 (SS), T1->T5 (FF), T1->T6 (SF), T1->T7 (deduplicated PRECEDES + SUCCEEDS)
      expect(edges).toHaveLength(6);
      expect(edges.find((e) => e.toId === 'T2')?.type).toBe('FS');
      expect(edges.find((e) => e.toId === 'T3')?.type).toBe('FS');
      expect(edges.find((e) => e.toId === 'T4')?.type).toBe('SS');
      expect(edges.find((e) => e.toId === 'T5')?.type).toBe('FF');
      expect(edges.find((e) => e.toId === 'T6')?.type).toBe('SF');
      expect(edges.find((e) => e.toId === 'T7')?.type).toBe('FS');

      const cpm = analyzeCriticalPath(items8Rel);
      const { columns } = buildTimelineData('week', new Date(2026, 4, 15), items8Rel);
      const barMap = new Map(items8Rel.map((it) => [it.id, mapItemToBar(it, columns, 'week')]));
      const rowYMap = new Map(items8Rel.map((it, idx) => [it.id, idx * 36 + 18]));

      const depLines = computeDependencyLines(items8Rel, barMap, rowYMap, cpm.criticalEdges);
      expect(depLines).toHaveLength(6);

      const lineT2 = depLines.find((l) => l.toItemId === 'T2')!;
      expect(lineT2.violated).toBe(true);
      expect(lineT2.status).toBe('violated');

      const lineT3 = depLines.find((l) => l.toItemId === 'T3')!;
      expect(lineT3.violated).toBe(false);
      expect(lineT3.isCritical).toBe(true);
      expect(lineT3.status).toBe('critical');

      const lineT4 = depLines.find((l) => l.toItemId === 'T4')!;
      expect(lineT4.violated).toBe(true);
      expect(lineT4.status).toBe('violated');

      const lineT5 = depLines.find((l) => l.toItemId === 'T5')!;
      expect(lineT5.violated).toBe(false);
      expect(lineT5.status).toBe('normal');

      const lineT6 = depLines.find((l) => l.toItemId === 'T6')!;
      expect(lineT6.violated).toBe(true);
      expect(lineT6.status).toBe('violated');
    });

    it('detects existing cycles (A -> B -> C -> A) without hanging in analyzeCriticalPath and blocks cycle-inducing edges in wouldCauseCycle', () => {
      const cyclicTasks: Item[] = [
        {
          id: 'A',
          title: 'Cycle A',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-06-01',
          dueDate: '2026-06-03',
          relations: [{ id: 'c1', type: 'blocks', targetWorkItemId: 'B' }],
        } as unknown as Item,
        {
          id: 'B',
          title: 'Cycle B',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-06-04',
          dueDate: '2026-06-06',
          relations: [{ id: 'c2', type: 'blocks', targetWorkItemId: 'C' }],
        } as unknown as Item,
        {
          id: 'C',
          title: 'Cycle C',
          columnId: 'todo',
          projectId: 'p1',
          startDate: '2026-06-07',
          dueDate: '2026-06-09',
          relations: [{ id: 'c3', type: 'blocks', targetWorkItemId: 'A' }],
        } as unknown as Item,
      ];

      const result = analyzeCriticalPath(cyclicTasks);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodeIds).toEqual(expect.arrayContaining(['A', 'B', 'C']));
      expect(result.topologicalOrder).toEqual([]);

      // Pre-flight check before closing cycle
      const dagEdges = [
        { fromId: 'A', toId: 'B', type: 'FS' as const },
        { fromId: 'B', toId: 'C', type: 'FS' as const },
      ];
      expect(wouldCauseCycle('C', 'A', dagEdges)).toBe(true);
      expect(wouldCauseCycle('A', 'C', dagEdges)).toBe(false);
    });

    it('handles zero-duration milestones (startDate === dueDate), reversed dates (dueDate < startDate), and leap-year spans (2028-02-28 to 2028-03-01)', () => {
      // Zero-duration milestone (same start and due day = 1 calendar day slot)
      expect(calculateTaskDuration('2026-07-10', '2026-07-10')).toBe(1);
      expect(calculateDuration('2026-07-10', '2026-07-10')).toEqual({ days: 1, label: '1 day' });

      // Reversed dates (dueDate < startDate) Clamped safely to minimum 1 day without negative width
      expect(calculateTaskDuration('2026-07-15', '2026-07-10')).toBe(1);
      expect(calculateDuration('2026-07-15', '2026-07-10')).toEqual({ days: 1, label: '1 day' });

      // Leap year 2028 span: 2028-02-28, 2028-02-29, 2028-03-01 => 3 inclusive days!
      // (In a non-leap year like 2027, Feb 28 to Mar 1 is only 2 days)
      expect(calculateTaskDuration('2028-02-28', '2028-03-01')).toBe(3);
      expect(calculateTaskDuration('2027-02-28', '2027-03-01')).toBe(2);
    });
  });

  describe('2. Calendar View Edge Cases (calendar.utils.ts)', () => {
    it('preserves exact date key across midnight UTC, positive/negative timezone offsets, and date-only strings without -1/+1 day drift', () => {
      // 1. Midnight UTC ISO string from createCalendarDueDate
      const dueIso = createCalendarDueDate('2028-02-29');
      expect(dueIso).toBe('2028-02-29T00:00:00.000Z');
      expect(isMidnightDueDate(dueIso)).toBe(true);
      expect(getCalendarDateKey(dueIso)).toBe('2028-02-29');

      // 2. Midnight with explicit timezone offsets (+07:00, -05:00)
      expect(isMidnightDueDate('2026-10-14T00:00:00+07:00')).toBe(true);
      expect(getCalendarDateKey('2026-10-14T00:00:00+07:00')).toBe('2026-10-14');
      expect(isMidnightDueDate('2026-10-14T00:00:00-05:00')).toBe(true);
      expect(getCalendarDateKey('2026-10-14T00:00:00-05:00')).toBe('2026-10-14');

      // 3. Plain YYYY-MM-DD key
      expect(getCalendarDateKey('2026-12-31')).toBe('2026-12-31');

      // 4. Null / empty / invalid inputs
      expect(getCalendarDateKey(null)).toBeNull();
      expect(getCalendarDateKey(undefined)).toBeNull();
      expect(getCalendarDateKey('invalid-date-string')).toBeNull();
    });
  });

  describe('3. your-work Personal Command Center Workflows (your-work.util.ts, activity.util.ts)', () => {
    const refDate = new Date(2026, 9, 14, 10, 0, 0); // 2026-10-14

    const triageItems: TriageItemCandidate[] = [
      {
        id: 'yw-1',
        title: 'Primary Assignee Overdue Active Task',
        columnId: 'in_progress',
        priority: 'urgent',
        assigneeId: 'user-alice',
        authorId: 'user-bob',
        subscriberIds: ['user-alice', 'user-charlie'],
        dueDate: '2026-10-10', // Overdue (4 days before Oct 14)
        completed: false,
        labels: [],
        comments: [],
        commentCount: 0,
        childWorkItems: [],
      },
      {
        id: 'yw-2',
        title: 'Multi-Assignee Array Due Soon Task (within 7-day window)',
        columnId: 'todo',
        priority: 'high',
        assigneeId: 'user-bob',
        assigneeIds: ['user-bob', 'user-alice'], // Alice is co-assignee!
        authorId: 'user-alice',
        subscribers: [{ id: 'user-alice' }, { userId: 'user-diana' }],
        dueDate: '2026-10-18', // 4 days after Oct 14 -> Due Soon!
        completed: false,
        labels: [],
        comments: [],
        commentCount: 0,
        childWorkItems: [],
      },
      {
        id: 'yw-3',
        title: 'Assignees Object Array Completed Past-Due Task',
        columnId: 'done',
        priority: 'medium',
        assignees: [{ userId: 'user-alice' }],
        author: { id: 'user-alice', name: 'Alice' },
        subscriberIds: ['user-alice'],
        dueDate: '2026-10-01', // In the past, but DONE -> must NOT be overdue!
        completed: true,
        labels: [],
        comments: [],
        commentCount: 0,
        childWorkItems: [],
      },
      {
        id: 'yw-4',
        title: 'Cancelled Past-Due Task',
        columnId: 'cancelled',
        priority: 'low',
        assignee: { id: 'user-alice', name: 'Alice' },
        createdBy: 'user-alice',
        subscriberIds: ['user-alice'],
        dueDate: '2026-10-05', // In the past, but CANCELLED -> must NOT be overdue or dueSoon!
        completed: false,
        labels: [],
        comments: [],
        commentCount: 0,
        childWorkItems: [],
      },
      {
        id: 'yw-5',
        title: 'Future Task Beyond 7-Day Window',
        columnId: 'backlog',
        priority: 'none',
        assigneeId: 'user-alice',
        authorId: 'user-diana',
        subscriberIds: [],
        dueDate: '2026-11-15', // > 7 days away
        completed: false,
        labels: [],
        comments: [],
        commentCount: 0,
        childWorkItems: [],
      },
    ];

    it('categorizes Assigned / Created / Subscribed across all multi-assignee & subscriber formats and handles mass subscription/unsubscription', () => {
      const categorized = categorizeWorkItemsForUser(triageItems, 'user-alice');

      // Alice is assigned to all 5 items via assigneeId, assigneeIds[], assignees[], or assignee.id
      expect(categorized.assigned.map((i) => i.id)).toEqual(['yw-1', 'yw-2', 'yw-3', 'yw-4', 'yw-5']);

      // Alice created yw-2 (authorId), yw-3 (author.id), yw-4 (createdBy)
      expect(categorized.created.map((i) => i.id)).toEqual(['yw-2', 'yw-3', 'yw-4']);

      // Alice is subscribed to yw-1..yw-4
      expect(categorized.subscribed.map((i) => i.id)).toEqual(['yw-1', 'yw-2', 'yw-3', 'yw-4']);

      // Mass-subscription & unsubscription simulation across all 42 dataset items
      const massSubscribed = dataset42.map((item) => ({
        ...item,
        subscriberIds: Array.from(new Set([...(item.subscriberIds || []), 'user-evan'])),
      }));
      expect(massSubscribed.every((item) => isSubscribedByUser(item as any, 'user-evan'))).toBe(true);

      const massUnsubscribed = massSubscribed.map((item) => ({
        ...item,
        subscriberIds: (item.subscriberIds || []).filter((id) => id !== 'user-evan'),
      }));
      expect(massUnsubscribed.some((item) => isSubscribedByUser(item as any, 'user-evan'))).toBe(false);
    });

    it('calculates Overdue, Due Soon (7-day window), and Completed in calculateSummaryStats while excluding DONE and CANCELLED items from overdue/dueSoon', () => {
      const stats = calculateSummaryStats(triageItems, refDate, 7);

      expect(stats).toEqual({
        total: 5,
        completed: 1, // yw-3
        cancelled: 1, // yw-4
        inProgress: 1, // yw-1
        unstarted: 1, // yw-2
        backlog: 1, // yw-5
        overdue: 1, // ONLY yw-1 (yw-3 is DONE and yw-4 is CANCELLED despite past dueDate!)
        dueSoon: 1, // ONLY yw-2 (due 2026-10-18, within 7 days of 2026-10-14)
        completionRate: 25, // 1 completed out of 4 non-cancelled active items (25%)
      });
    });

    it('computes Priority & State breakdowns and sorts/filters Activity feeds cleanly', () => {
      const prioBreakdown = calculatePriorityBreakdown(triageItems);
      expect(prioBreakdown).toEqual({
        urgent: 1,
        high: 1,
        medium: 1,
        low: 1,
        none: 1,
      });

      const stateBreakdown = calculateStateBreakdown(triageItems);
      expect(stateBreakdown.backlog).toBe(1);
      expect(stateBreakdown.unstarted).toBe(1);
      expect(stateBreakdown.started).toBe(1);
      expect(stateBreakdown.completed).toBe(1);
      expect(stateBreakdown.cancelled).toBe(1);
      expect(calculateStatusBreakdown(triageItems)).toEqual(stateBreakdown);

      const activities = [
        {
          id: 'act-old',
          type: 'work_item_created',
          actorName: 'Bob Navier',
          actionVerb: 'created',
          targetIdentifier: 'FLUX-1',
          targetTitle: 'Derive Navier-Stokes vorticity',
          time: '2026-10-10T08:00:00.000Z',
          project: { id: 'proj-1', name: 'CFD Solver' },
        },
        {
          id: 'act-new',
          type: 'work_item_commented',
          actorName: 'Alice Turing',
          actionVerb: 'commented on',
          targetIdentifier: 'FLUX-3',
          targetTitle: 'FlashAttention-3 FP8 kernel',
          time: '2026-10-14T09:30:00.000Z',
          project: { id: 'proj-2', name: 'LLaMA-70B' },
        },
        {
          id: 'act-mid',
          type: 'work_item_updated',
          actorName: 'Alice Turing',
          actionVerb: 'moved to In Review',
          targetIdentifier: 'FLUX-2',
          targetTitle: 'Provision 64x H100 SXM5',
          time: '2026-10-12T15:00:00.000Z',
          project: 'proj-2',
        },
      ];

      const sortedDesc = sortActivities(activities, 'desc');
      expect(sortedDesc.map((a) => a.id)).toEqual(['act-new', 'act-mid', 'act-old']);

      const filteredProj2 = filterAndSortActivities(activities, {
        projectId: 'proj-2',
        actorName: 'Alice Turing',
        search: 'H100',
      });
      expect(filteredProj2.map((a) => a.id)).toEqual(['act-mid']);
    });
  });

  describe('4. Centralized Toast & Attachment / Activity State Helpers (use-work-item-toast.ts, modal.utils.ts)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('deduplicates workItemToast notifications by WORK_ITEM_TOAST_IDS[scope] and resolves Error / string / fallback messages', () => {
      workItemToast.success('Saved item', 'action');
      expect(toast.success).toHaveBeenCalledWith('Saved item', {
        id: WORK_ITEM_TOAST_IDS.action,
      });

      // Error instance with message
      workItemToast.error(new Error('Network timeout on H100 node'), 'Fallback msg', 'bulk');
      expect(toast.error).toHaveBeenCalledWith('Network timeout on H100 node', {
        id: WORK_ITEM_TOAST_IDS.bulk,
      });

      // Plain string error
      workItemToast.error('Forbidden relation cycle', 'Fallback msg', 'relation');
      expect(toast.error).toHaveBeenCalledWith('Forbidden relation cycle', {
        id: WORK_ITEM_TOAST_IDS.relation,
      });

      // Empty error object falls back to fallback string
      workItemToast.error({ status: 500 }, 'Failed to upload attachment', 'upload');
      expect(toast.error).toHaveBeenCalledWith('Failed to upload attachment', {
        id: WORK_ITEM_TOAST_IDS.upload,
      });

      workItemToast.dismiss('upload');
      expect(toast.dismiss).toHaveBeenCalledWith(WORK_ITEM_TOAST_IDS.upload);
    });

    it('deduplicates pages/papers in AttachmentStateHelpers, renames files, removes links by index or URL, and merges comments + activity logs chronologically', () => {
      let state = { ...EMPTY_ATTACHMENTS };

      // 1. addPage deduplication by pageId
      state = AttachmentStateHelpers.addPage(state, { pageId: 'pg-1', title: 'Spec v1' });
      state = AttachmentStateHelpers.addPage(state, { pageId: 'pg-1', title: 'Spec v1 Duplicate' });
      expect(state.pages).toHaveLength(1);
      expect(state.pages[0].title).toBe('Spec v1');

      // 2. addPaper deduplication by paperId
      state = AttachmentStateHelpers.addPaper(state, {
        paperId: 'arx-2307',
        title: 'FlashAttention-2',
        doi: '10.48550/arXiv.2307.08691',
      });
      state = AttachmentStateHelpers.addPaper(state, {
        paperId: 'arx-2307',
        title: 'FlashAttention-2 Duplicate',
      });
      expect(state.papers).toHaveLength(1);

      // 3. addFile & renameFile
      state = AttachmentStateHelpers.addFile(state, {
        name: 'draft.tex',
        url: 'https://flux.ai/draft.tex',
        size: 20480,
        type: 'text/x-tex',
      });
      expect(state.files).toHaveLength(1);
      const fileId = state.files[0].id;
      expect(state.files[0].size).toBe('20 KB');

      state = AttachmentStateHelpers.renameFile(state, fileId, 'camera-ready.tex');
      expect(state.files[0].name).toBe('camera-ready.tex');

      // 4. addLink & removeLink by index AND by URL
      state = AttachmentStateHelpers.addLink(state, {
        title: 'WandB Run 1',
        url: 'https://wandb.ai/flux/run-1',
      });
      state = AttachmentStateHelpers.addLink(state, {
        title: 'WandB Run 2',
        url: 'https://wandb.ai/flux/run-2',
      });
      state = AttachmentStateHelpers.addLink(state, {
        title: 'WandB Run 3',
        url: 'https://wandb.ai/flux/run-3',
      });
      expect(state.links).toHaveLength(3);

      // Remove by index 0
      state = AttachmentStateHelpers.removeLink(state, 0);
      expect(state.links.map((l) => l.title)).toEqual(['WandB Run 2', 'WandB Run 3']);

      // Remove by URL string
      state = AttachmentStateHelpers.removeLink(state, 'https://wandb.ai/flux/run-3');
      expect(state.links.map((l) => l.title)).toEqual(['WandB Run 2']);

      // 5. buildActivityEntries chronological descending merge of comments + history logs
      const comments = [
        {
          id: 'c-1',
          author: { name: 'Alice Turing' },
          content: 'Verified $\\mathcal{O}(N)$ complexity.',
          createdAt: '2026-10-14T10:00:00.000Z',
          reactions: { '🚀': ['user-bob'] },
        },
      ];
      const historyLogs = [
        {
          id: 'h-1',
          user: { name: 'Bob Navier' },
          message: 'changed priority to Urgent',
          createdAt: '2026-10-14T11:00:00.000Z',
        },
        {
          id: 'h-0',
          user: { name: 'Diana Stokes' },
          action: 'created this work item',
          createdAt: '2026-10-14T09:00:00.000Z',
        },
      ];

      const merged = buildActivityEntries(comments, historyLogs);
      expect(merged.map((e) => e.id)).toEqual(['h-1', 'c-1', 'h-0']);
      expect(merged[1].kind).toBe('comment');
      expect(merged[1].reactionEmoji).toBe('🚀');
      expect(merged[1].authorInitials).toBe('AT');
    });
  });
});
