/**
 * Centralized Client Memory Governor & Federated Cache Mediator (`@/shared/lib/memory-governor`)
 *
 * Implements classic Gang of Four (GoF) patterns for browser memory governance:
 * 1. Mediator Pattern (`ClientMemoryGovernor`): Centralizes lifecycle coordination across
 *    decoupled domain caches (Editor, PDF Reader, TanStack Query, Realtime Pools) without
 *    upward imports from `shared/` into `features/`.
 * 2. Strategy Pattern (`HardwareMemoryBudgetStrategy`): Selects adaptive memory capacities
 *    (`LowTierBudgetStrategy`, `StandardTierBudgetStrategy`, `HighTierBudgetStrategy`)
 *    from W3C `navigator.deviceMemory` and `navigator.hardwareConcurrency`.
 * 3. Observer Pattern (`MemoryParticipant` subscriptions): Dispatches multi-stage reclamation
 *    signals (`route-handover`, `tab-hidden`, `pressure`, `logout`) to registered domain participants.
 * 4. Composite Pattern (`getAggregateSnapshot()`): Collects and rolls up heterogeneous memory
 *    telemetry across all registered participants into a single tree snapshot.
 * 5. Template Method / Chain of Escalation (`reclaim(level)`): Executes prioritized, error-isolated
 *    memory reclamation across participants.
 */

import { logger } from '@/shared/lib/logger';
import { multiTabBus } from '@/shared/lib/multi-tab';

// ─── 1. Hardware Tier & Strategy Pattern (GoF Strategy) ───────────────────────

export type HardwareMemoryTier = 'low' | 'standard' | 'high';

export type ActiveWorkspaceDomain = 'editor' | 'reader' | 'workspace' | 'other';

export interface HardwareMemoryBudget {
  readonly tier: HardwareMemoryTier;
  readonly deviceMemoryGb: number;
  readonly hardwareConcurrency: number;
  /** Maximum warm standby tabs for CodeMirror Editor and PDF Reader (3 / 5 / 8) */
  readonly warmTabPoolCapacity: number;
  /** Maximum in-memory text documents in Editor LRUDocumentCache (20 / 40 / 64) */
  readonly lruMaxFiles: number;
  /** Maximum UTF-8 byte ceiling for Editor LRUDocumentCache (8 MB / 16 MB / 32 MB) */
  readonly lruMaxBytes: number;
  /** Maximum cached authorized figure Blob ObjectURLs in Visual Mode (16 / 32 / 48) */
  readonly maxVisualFigureBlobs: number;
  /** Maximum cached KaTeX HTML strings in Visual Mode (120 / 250 / 400) */
  readonly maxKatexCacheEntries: number;
  /** Maximum cached PDF page hover geometry objects in Reader (8 / 16 / 24) */
  readonly maxReaderHoverGeometryPages: number;
  /** Idle background duration before deep tab hibernation triggers (ms) */
  readonly backgroundHibernationMs: number;
}

export interface IHardwareBudgetStrategy {
  readonly tier: HardwareMemoryTier;
  buildBudget(deviceMemoryGb: number, hardwareConcurrency: number): HardwareMemoryBudget;
}

class LowTierBudgetStrategy implements IHardwareBudgetStrategy {
  public readonly tier: HardwareMemoryTier = 'low';

  public buildBudget(deviceMemoryGb: number, hardwareConcurrency: number): HardwareMemoryBudget {
    return {
      tier: 'low',
      deviceMemoryGb,
      hardwareConcurrency,
      warmTabPoolCapacity: 3,
      lruMaxFiles: 20,
      lruMaxBytes: 8 * 1024 * 1024, // 8 MB
      maxVisualFigureBlobs: 16,
      maxKatexCacheEntries: 120,
      maxReaderHoverGeometryPages: 8,
      backgroundHibernationMs: 90 * 1000, // 1.5 minutes on low-RAM devices
    };
  }
}

class StandardTierBudgetStrategy implements IHardwareBudgetStrategy {
  public readonly tier: HardwareMemoryTier = 'standard';

  public buildBudget(deviceMemoryGb: number, hardwareConcurrency: number): HardwareMemoryBudget {
    return {
      tier: 'standard',
      deviceMemoryGb,
      hardwareConcurrency,
      warmTabPoolCapacity: 5,
      lruMaxFiles: 40,
      lruMaxBytes: 16 * 1024 * 1024, // 16 MB
      maxVisualFigureBlobs: 32,
      maxKatexCacheEntries: 250,
      maxReaderHoverGeometryPages: 16,
      backgroundHibernationMs: 3 * 60 * 1000, // 3 minutes
    };
  }
}

class HighTierBudgetStrategy implements IHardwareBudgetStrategy {
  public readonly tier: HardwareMemoryTier = 'high';

  public buildBudget(deviceMemoryGb: number, hardwareConcurrency: number): HardwareMemoryBudget {
    return {
      tier: 'high',
      deviceMemoryGb,
      hardwareConcurrency,
      warmTabPoolCapacity: 8,
      lruMaxFiles: 64,
      lruMaxBytes: 32 * 1024 * 1024, // 32 MB
      maxVisualFigureBlobs: 48,
      maxKatexCacheEntries: 400,
      maxReaderHoverGeometryPages: 24,
      backgroundHibernationMs: 5 * 60 * 1000, // 5 minutes
    };
  }
}

const LOW_STRATEGY = new LowTierBudgetStrategy();
const STANDARD_STRATEGY = new StandardTierBudgetStrategy();
const HIGH_STRATEGY = new HighTierBudgetStrategy();

export function resolveHardwareBudget(overrideDeviceMemoryGb?: number): HardwareMemoryBudget {
  const detectedRam =
    typeof overrideDeviceMemoryGb === 'number' &&
    Number.isFinite(overrideDeviceMemoryGb) &&
    overrideDeviceMemoryGb > 0
      ? overrideDeviceMemoryGb
      : typeof navigator !== 'undefined' &&
          'deviceMemory' in navigator &&
          typeof (navigator as { deviceMemory?: number }).deviceMemory === 'number'
        ? (navigator as { deviceMemory: number }).deviceMemory
        : 4;

  const detectedCores =
    typeof navigator !== 'undefined' &&
    typeof navigator.hardwareConcurrency === 'number' &&
    navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : 4;

  let strategy: IHardwareBudgetStrategy = STANDARD_STRATEGY;
  if (detectedRam <= 2) {
    strategy = LOW_STRATEGY;
  } else if (detectedRam >= 8) {
    strategy = HIGH_STRATEGY;
  }

  return strategy.buildBudget(detectedRam, detectedCores);
}

// ─── 2. Participant & Reclamation Contracts (GoF Observer + Composite) ────────

/**
 * Escalating memory reclamation levels:
 * - `route-handover`: User navigated away from a heavy domain (e.g. left `/library/papers` for `/pages`).
 *   Inactive domain should release warm standby pools while active domain keeps full allocation.
 * - `tab-hidden`: Browser tab has remained hidden in the background past `backgroundHibernationMs`.
 *   All participants should release warm standby caches & non-active ObjectURLs.
 * - `pressure`: High JS heap utilization (>80% of `jsHeapSizeLimit`) or explicit low-memory pressure.
 *   Participants must aggressively evict all non-essential caches and inactive queries.
 * - `logout`: User signed out or session expired.
 *   Participants must wipe 100% of user-scoped RAM caches and revoke all ObjectURLs.
 */
export type MemoryReclaimLevel = 'route-handover' | 'tab-hidden' | 'pressure' | 'logout';

export interface MemoryReclaimContext {
  readonly level: MemoryReclaimLevel;
  readonly activeDomain: ActiveWorkspaceDomain;
  readonly timestamp: number;
}

export interface MemoryParticipantStats {
  readonly id: string;
  readonly domain: ActiveWorkspaceDomain | 'global';
  readonly entryCount: number;
  readonly estimatedBytes?: number;
  readonly details?: Record<string, number | string | boolean | null>;
}

export interface MemoryParticipant {
  readonly id: string;
  readonly domain: ActiveWorkspaceDomain | 'global';
  /**
   * Priority order during reclamation (lower runs first, default 50).
   */
  readonly priority?: number;
  /**
   * Invoked by the Mediator when memory should be reclaimed.
   * Returns the number of evicted entries (optional, for telemetry).
   */
  reclaim(context: MemoryReclaimContext): number | void;
  /**
   * Returns a live telemetry snapshot of the participant's current RAM footprint.
   */
  getStats?(): MemoryParticipantStats;
}

export interface SystemHeapMetrics {
  readonly usedJSHeapSize: number | null;
  readonly totalJSHeapSize: number | null;
  readonly jsHeapSizeLimit: number | null;
  readonly utilizationRatio: number | null;
}

export interface AggregateMemorySnapshot {
  readonly budget: HardwareMemoryBudget;
  readonly activeDomain: ActiveWorkspaceDomain;
  readonly heap: SystemHeapMetrics;
  readonly totalEntries: number;
  readonly totalEstimatedBytes: number;
  readonly participants: MemoryParticipantStats[];
  readonly timestamp: number;
}

const HEAP_PRESSURE_RATIO_THRESHOLD = 0.82;
const PRESSURE_CHECK_INTERVAL_MS = 60 * 1000;

// ─── 3. Centralized Memory Governor (GoF Mediator) ────────────────────────────

export class ClientMemoryGovernor {
  private readonly participants = new Map<string, MemoryParticipant>();
  private budget: HardwareMemoryBudget = resolveHardwareBudget();
  private activeDomain: ActiveWorkspaceDomain = 'workspace';
  private hibernationTimer: ReturnType<typeof setTimeout> | null = null;
  private pressureCheckTimer: ReturnType<typeof setInterval> | null = null;
  private multiTabUnsub: (() => void) | null = null;
  private initialized = false;

  constructor() {
    this.initLifecycleHooks();
  }

  public initLifecycleHooks(): void {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;
    this.budget = resolveHardwareBudget();

    // 1. Cross-Tab Logout Listener
    this.multiTabUnsub = multiTabBus.subscribe((event) => {
      if (event.type === 'AUTH_LOGOUT') {
        this.reclaim('logout');
      }
    });

    // 2. Page Visibility Deep Hibernation Listener
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // 3. Periodic V8 Heap Pressure Watchdog (Chromium performance.memory)
    this.pressureCheckTimer = setInterval(() => {
      if (this.isUnderHeapPressure()) {
        logger.warn('[MemoryGovernor] High JS Heap pressure detected, triggering reclaim(pressure)');
        this.reclaim('pressure');
      }
    }, PRESSURE_CHECK_INTERVAL_MS);
  }

  public dispose(): void {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.hibernationTimer) {
      clearTimeout(this.hibernationTimer);
      this.hibernationTimer = null;
    }
    if (this.pressureCheckTimer) {
      clearInterval(this.pressureCheckTimer);
      this.pressureCheckTimer = null;
    }
    this.multiTabUnsub?.();
    this.multiTabUnsub = null;
    this.initialized = false;
  }

  private handleVisibilityChange = (): void => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      if (this.hibernationTimer) clearTimeout(this.hibernationTimer);
      this.hibernationTimer = setTimeout(() => {
        this.hibernationTimer = null;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          this.reclaim('tab-hidden');
        }
      }, this.budget.backgroundHibernationMs);
    } else if (this.hibernationTimer) {
      clearTimeout(this.hibernationTimer);
      this.hibernationTimer = null;
    }
  };

  /**
   * Returns the hardware-adaptive memory budget for the current device.
   */
  public getBudget(overrideDeviceMemoryGb?: number): HardwareMemoryBudget {
    if (overrideDeviceMemoryGb !== undefined) {
      return resolveHardwareBudget(overrideDeviceMemoryGb);
    }
    return this.budget;
  }

  /**
   * Registers a federated domain cache participant with the Governor.
   * Returns an unregister cleanup function.
   */
  public register(participant: MemoryParticipant): () => void {
    this.participants.set(participant.id, participant);
    return () => {
      if (this.participants.get(participant.id) === participant) {
        this.participants.delete(participant.id);
      }
    };
  }

  /**
   * Notifies the Governor that the user has transitioned to a specific workspace domain.
   * Automatically triggers `route-handover` reclamation on inactive heavy domains
   * (e.g. releasing Reader warm PDFs when entering the LaTeX Editor, and vice versa).
   */
  public setActiveDomain(nextDomain: ActiveWorkspaceDomain): void {
    const prevDomain = this.activeDomain;
    if (prevDomain === nextDomain) return;
    this.activeDomain = nextDomain;

    if (prevDomain === 'editor' || prevDomain === 'reader') {
      this.reclaim('route-handover');
    }
  }

  public getActiveDomain(): ActiveWorkspaceDomain {
    return this.activeDomain;
  }

  /**
   * Dispatches a synchronized memory reclamation signal across all registered participants
   * in priority order (GoF Mediator + Template Method).
   */
  public reclaim(level: MemoryReclaimLevel): number {
    const context: MemoryReclaimContext = {
      level,
      activeDomain: this.activeDomain,
      timestamp: Date.now(),
    };

    const sortedParticipants = Array.from(this.participants.values()).sort(
      (a, b) => (a.priority ?? 50) - (b.priority ?? 50),
    );

    let totalReclaimed = 0;
    for (const participant of sortedParticipants) {
      // On route-handover, skip reclaiming from the domain the user just entered
      if (
        level === 'route-handover' &&
        (participant.domain === this.activeDomain || participant.domain === 'global')
      ) {
        continue;
      }

      try {
        const count = participant.reclaim(context);
        if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
          totalReclaimed += count;
        }
      } catch (err) {
        logger.warn(`[MemoryGovernor] Participant "${participant.id}" failed during reclaim(${level})`, {
          error: err,
        });
      }
    }

    return totalReclaimed;
  }

  /**
   * Reads Chromium's `performance.memory` metrics when available.
   */
  public getHeapMetrics(): SystemHeapMetrics {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const mem = (
        performance as unknown as {
          memory?: {
            usedJSHeapSize?: number;
            totalJSHeapSize?: number;
            jsHeapSizeLimit?: number;
          };
        }
      ).memory;
      if (mem && typeof mem.usedJSHeapSize === 'number' && typeof mem.jsHeapSizeLimit === 'number') {
        const ratio =
          mem.jsHeapSizeLimit > 0 ? Number((mem.usedJSHeapSize / mem.jsHeapSizeLimit).toFixed(4)) : null;
        return {
          usedJSHeapSize: mem.usedJSHeapSize,
          totalJSHeapSize: mem.totalJSHeapSize ?? null,
          jsHeapSizeLimit: mem.jsHeapSizeLimit,
          utilizationRatio: ratio,
        };
      }
    }
    return {
      usedJSHeapSize: null,
      totalJSHeapSize: null,
      jsHeapSizeLimit: null,
      utilizationRatio: null,
    };
  }

  public isUnderHeapPressure(): boolean {
    const { utilizationRatio } = this.getHeapMetrics();
    return utilizationRatio !== null && utilizationRatio >= HEAP_PRESSURE_RATIO_THRESHOLD;
  }

  /**
   * Collects a composite memory telemetry snapshot across all federated domain participants (GoF Composite).
   */
  public getAggregateSnapshot(): AggregateMemorySnapshot {
    const participantStats: MemoryParticipantStats[] = [];
    let totalEntries = 0;
    let totalEstimatedBytes = 0;

    for (const participant of this.participants.values()) {
      try {
        const stats = participant.getStats
          ? participant.getStats()
          : {
              id: participant.id,
              domain: participant.domain,
              entryCount: 0,
            };
        participantStats.push(stats);
        totalEntries += stats.entryCount;
        if (typeof stats.estimatedBytes === 'number' && Number.isFinite(stats.estimatedBytes)) {
          totalEstimatedBytes += stats.estimatedBytes;
        }
      } catch {
        // Isolate participant stats errors
      }
    }

    return {
      budget: this.budget,
      activeDomain: this.activeDomain,
      heap: this.getHeapMetrics(),
      totalEntries,
      totalEstimatedBytes,
      participants: participantStats,
      timestamp: Date.now(),
    };
  }
}

export const memoryGovernor = new ClientMemoryGovernor();
