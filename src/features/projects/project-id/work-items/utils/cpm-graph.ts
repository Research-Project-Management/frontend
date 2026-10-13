/**
 * cpm-graph.ts
 *
 * Critical Path Method (CPM) & DAG Dependency Graph Engine for Flux Gantt/Timeline.
 *
 * Features:
 * - Directed Acyclic Graph (DAG) construction with bidirectional relation normalization.
 * - Circular dependency (cycle) detection via Kahn's algorithm and 3-color DFS.
 * - CPM Forward Pass (Earliest Start / Earliest Finish).
 * - CPM Backward Pass (Latest Start / Latest Finish).
 * - Total Float (Slack) computation and Critical Path identification.
 * - Sub-millisecond execution ($O(V + E)$ time, $O(V + E)$ space).
 * - High-speed binary search coordinate resolver ($O(\log C)$ replacing $O(C)$ linear scan).
 */

import type { Item } from '../types/work-item.types';

export type CpmDependencyType = 'FS' | 'SS' | 'FF';

export interface CpmEdge {
  fromId: string;
  toId: string;
  type: CpmDependencyType;
  lagDays?: number;
}

export interface CpmTaskNode {
  id: string;
  title: string;
  durationDays: number;
  startDate?: Date | null;
  dueDate?: Date | null;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  slackDays: number;
  isCritical: boolean;
  predecessors: string[];
  successors: string[];
}

export interface CpmAnalysisResult {
  nodes: Map<string, CpmTaskNode>;
  criticalPathItemIds: Set<string>;
  criticalEdges: Set<string>; // "fromId->toId"
  hasCycle: boolean;
  cycleNodeIds: string[];
  projectDurationDays: number;
  topologicalOrder: string[];
}

/**
 * Parses a date string safely into local date at 00:00:00.
 */
export function parseDateOnly(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Calculates duration in days (minimum 1 day).
 */
export function calculateTaskDuration(startDate?: string | null, dueDate?: string | null): number {
  const start = parseDateOnly(startDate);
  const due = parseDateOnly(dueDate);
  if (start && due) {
    const diffMs = due.getTime() - start.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days);
  }
  return 1;
}

/**
 * Normalizes item relations into directed edges:
 * - 'blocks': item -> target (item must finish before target can start)
 * - 'blocked_by': target -> item (target must finish before item can start)
 * - 'starts_before': item -> target (SS)
 * - 'starts_after': target -> item (SS)
 * - 'finishes_before': item -> target (FF)
 * - 'finishes_after': target -> item (FF)
 */
export function extractNormalizedEdges(items: Item[]): CpmEdge[] {
  const edges: CpmEdge[] = [];
  const validIds = new Set(items.map((i) => i.id));
  const seenEdges = new Set<string>();

  for (const item of items) {
    const relations =
      (item.relations as Array<{ targetWorkItemId?: string; targetId?: string; type?: string }>) || [];
    if (!Array.isArray(relations) || relations.length === 0) continue;

    for (const rel of relations) {
      const type = rel?.type;
      const targetId = rel?.targetWorkItemId || rel?.targetId;
      if (!type || !targetId || !validIds.has(targetId) || item.id === targetId) continue;

      let fromId: string;
      let toId: string;
      let depType: CpmDependencyType;

      switch (type) {
        case 'blocks':
          fromId = item.id;
          toId = targetId;
          depType = 'FS';
          break;
        case 'blocked_by':
          fromId = targetId;
          toId = item.id;
          depType = 'FS';
          break;
        case 'starts_before':
          fromId = item.id;
          toId = targetId;
          depType = 'SS';
          break;
        case 'starts_after':
          fromId = targetId;
          toId = item.id;
          depType = 'SS';
          break;
        case 'finishes_before':
          fromId = item.id;
          toId = targetId;
          depType = 'FF';
          break;
        case 'finishes_after':
          fromId = targetId;
          toId = item.id;
          depType = 'FF';
          break;
        default:
          continue;
      }

      const edgeKey = `${fromId}->${toId}:${depType}`;
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        edges.push({ fromId, toId, type: depType });
      }
    }
  }

  return edges;
}

/**
 * Detects cycles in a directed graph using DFS 3-color graph traversal.
 * White (0): unvisited, Gray (1): currently in recursion stack, Black (2): completely visited.
 */
export function detectGraphCycles(
  nodeIds: string[],
  adjList: Map<string, string[]>
): { hasCycle: boolean; cycleNodes: string[] } {
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  let cycleNodes: string[] = [];
  let foundCycle = false;

  for (const id of nodeIds) {
    color.set(id, 0);
  }

  function dfs(u: string): boolean {
    color.set(u, 1);
    const neighbors = adjList.get(u) || [];

    for (const v of neighbors) {
      if (color.get(v) === 1) {
        // Back-edge found! Reconstruct cycle path
        foundCycle = true;
        const path: string[] = [v, u];
        let curr = parent.get(u);
        while (curr && curr !== v) {
          path.push(curr);
          curr = parent.get(curr) || null;
        }
        path.push(v);
        cycleNodes = path.reverse();
        return true;
      }

      if (color.get(v) === 0) {
        parent.set(v, u);
        if (dfs(v)) return true;
      }
    }

    color.set(u, 2);
    return false;
  }

  for (const id of nodeIds) {
    if (color.get(id) === 0) {
      if (dfs(id)) break;
    }
  }

  return { hasCycle: foundCycle, cycleNodes };
}

/**
 * Computes Topological Order using Kahn's Algorithm.
 */
export function computeTopologicalSort(
  nodeIds: string[],
  adjList: Map<string, string[]>,
  inDegrees: Map<string, number>
): { order: string[]; isDag: boolean } {
  const inDegreeCopy = new Map(inDegrees);
  const queue: string[] = [];

  for (const id of nodeIds) {
    if ((inDegreeCopy.get(id) || 0) === 0) {
      queue.push(id);
    }
  }

  const order: string[] = [];

  while (queue.length > 0) {
    const u = queue.shift()!;
    order.push(u);

    const neighbors = adjList.get(u) || [];
    for (const v of neighbors) {
      const currentIn = inDegreeCopy.get(v) || 0;
      const nextIn = currentIn - 1;
      inDegreeCopy.set(v, nextIn);
      if (nextIn === 0) {
        queue.push(v);
      }
    }
  }

  return {
    order,
    isDag: order.length === nodeIds.length,
  };
}

/**
 * Critical Path Method (CPM) Engine.
 *
 * Computes:
 * - Forward Pass: Earliest Start (ES) and Earliest Finish (EF).
 * - Backward Pass: Latest Finish (LF) and Latest Start (LS).
 * - Float / Slack: TF = LS - ES = LF - EF.
 * - Critical Path identification (TF <= 0 on connected paths).
 */
export function analyzeCriticalPath(items: Item[]): CpmAnalysisResult {
  const nodes = new Map<string, CpmTaskNode>();
  const itemMap = new Map<string, Item>(items.map((i) => [i.id, i]));
  const itemIds = items.map((i) => i.id);

  // 1. Initialize node records
  for (const item of items) {
    const duration = calculateTaskDuration(item.startDate, item.dueDate);
    nodes.set(item.id, {
      id: item.id,
      title: item.title,
      durationDays: duration,
      startDate: parseDateOnly(item.startDate),
      dueDate: parseDateOnly(item.dueDate),
      earliestStart: 0,
      earliestFinish: duration,
      latestStart: 0,
      latestFinish: duration,
      slackDays: 0,
      isCritical: false,
      predecessors: [],
      successors: [],
    });
  }

  // 2. Extract edges and build adjacency lists
  const edges = extractNormalizedEdges(items);
  const adjList = new Map<string, string[]>();
  const revAdjList = new Map<string, Array<{ from: string; type: CpmDependencyType }>>();
  const inDegrees = new Map<string, number>();

  for (const id of itemIds) {
    adjList.set(id, []);
    revAdjList.set(id, []);
    inDegrees.set(id, 0);
  }

  const edgeMap = new Map<string, CpmDependencyType>();

  for (const edge of edges) {
    const list = adjList.get(edge.fromId) || [];
    list.push(edge.toId);
    adjList.set(edge.fromId, list);

    const revList = revAdjList.get(edge.toId) || [];
    revList.push({ from: edge.fromId, type: edge.type });
    revAdjList.set(edge.toId, revList);

    inDegrees.set(edge.toId, (inDegrees.get(edge.toId) || 0) + 1);

    const fromNode = nodes.get(edge.fromId);
    const toNode = nodes.get(edge.toId);
    if (fromNode && !fromNode.successors.includes(edge.toId)) {
      fromNode.successors.push(edge.toId);
    }
    if (toNode && !toNode.predecessors.includes(edge.fromId)) {
      toNode.predecessors.push(edge.fromId);
    }

    edgeMap.set(`${edge.fromId}->${edge.toId}`, edge.type);
  }

  // 3. Cycle Detection
  const { hasCycle, cycleNodes } = detectGraphCycles(itemIds, adjList);
  if (hasCycle) {
    return {
      nodes,
      criticalPathItemIds: new Set<string>(),
      criticalEdges: new Set<string>(),
      hasCycle: true,
      cycleNodeIds: cycleNodes,
      projectDurationDays: 0,
      topologicalOrder: [],
    };
  }

  // 4. Topological Sort
  const { order: topoOrder } = computeTopologicalSort(itemIds, adjList, inDegrees);

  // 5. Forward Pass: Calculate Earliest Start (ES) and Earliest Finish (EF)
  for (const u of topoOrder) {
    const node = nodes.get(u)!;
    const preds = revAdjList.get(u) || [];

    let maxPredFinish = 0;
    for (const pred of preds) {
      const predNode = nodes.get(pred.from);
      if (!predNode) continue;

      if (pred.type === 'FS') {
        maxPredFinish = Math.max(maxPredFinish, predNode.earliestFinish);
      } else if (pred.type === 'SS') {
        maxPredFinish = Math.max(maxPredFinish, predNode.earliestStart);
      } else if (pred.type === 'FF') {
        maxPredFinish = Math.max(maxPredFinish, predNode.earliestFinish - node.durationDays);
      }
    }

    node.earliestStart = maxPredFinish;
    node.earliestFinish = node.earliestStart + node.durationDays;
  }

  // Determine overall project duration
  let projectDurationDays = 0;
  for (const node of nodes.values()) {
    if (node.earliestFinish > projectDurationDays) {
      projectDurationDays = node.earliestFinish;
    }
  }

  // 6. Backward Pass: Calculate Latest Finish (LF) and Latest Start (LS)
  // Initialize terminal nodes with project duration
  for (const node of nodes.values()) {
    node.latestFinish = projectDurationDays;
    node.latestStart = node.latestFinish - node.durationDays;
  }

  // Traverse in reverse topological order
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const u = topoOrder[i];
    const node = nodes.get(u)!;
    const succs = adjList.get(u) || [];

    if (succs.length > 0) {
      let minSuccStart = projectDurationDays;

      for (const succId of succs) {
        const succNode = nodes.get(succId);
        if (!succNode) continue;
        const depType = edgeMap.get(`${u}->${succId}`) || 'FS';

        if (depType === 'FS') {
          minSuccStart = Math.min(minSuccStart, succNode.latestStart);
        } else if (depType === 'SS') {
          minSuccStart = Math.min(minSuccStart, succNode.latestStart + node.durationDays);
        } else if (depType === 'FF') {
          minSuccStart = Math.min(minSuccStart, succNode.latestFinish);
        }
      }

      node.latestFinish = minSuccStart;
      node.latestStart = node.latestFinish - node.durationDays;
    }
  }

  // 7. Calculate Slack and identify Critical Path
  const criticalPathItemIds = new Set<string>();
  const criticalEdges = new Set<string>();

  // Only consider nodes that are part of a dependency chain (have preds or succs)
  // or standalone project if there are any dependencies
  const hasAnyEdges = edges.length > 0;

  for (const node of nodes.values()) {
    node.slackDays = Math.max(0, node.latestStart - node.earliestStart);
    const isPartOfDependencies = node.predecessors.length > 0 || node.successors.length > 0;

    if (hasAnyEdges) {
      if (isPartOfDependencies && node.slackDays <= 0.001) {
        node.isCritical = true;
        criticalPathItemIds.add(node.id);
      }
    } else {
      // If no dependencies at all, nothing is on a critical constraint path
      node.isCritical = false;
    }
  }

  // Identify critical edges (edges connecting two critical nodes where EF(u) === ES(v))
  for (const edge of edges) {
    const fromNode = nodes.get(edge.fromId);
    const toNode = nodes.get(edge.toId);
    if (fromNode?.isCritical && toNode?.isCritical) {
      if (Math.abs(fromNode.earliestFinish - toNode.earliestStart) <= 0.001) {
        criticalEdges.add(`${edge.fromId}->${edge.toId}`);
      }
    }
  }

  return {
    nodes,
    criticalPathItemIds,
    criticalEdges,
    hasCycle: false,
    cycleNodeIds: [],
    projectDurationDays,
    topologicalOrder: topoOrder,
  };
}

/**
 * Fast O(log C) binary search to resolve pixel X position for a timestamp.
 * Replaces O(C) linear iteration across columns.
 */
export function getPixelForTimeBinarySearch(
  time: number,
  columns: Array<{ startDate: Date; endDate: Date; width: number }>,
  isEnd = false
): number {
  const len = columns.length;
  if (len === 0) return 0;

  const minTime = columns[0].startDate.getTime();
  const maxTime = columns[len - 1].endDate.getTime();

  if (time <= minTime) return 0;
  if (time >= maxTime) {
    return len * columns[0].width;
  }

  // Binary search for target column: O(log C)
  let low = 0;
  let high = len - 1;
  let targetIdx = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const col = columns[mid];
    const cStart = col.startDate.getTime();
    const cEnd = col.endDate.getTime();

    if (time >= cStart && time <= cEnd) {
      targetIdx = mid;
      break;
    } else if (time < cStart) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  if (targetIdx === -1) {
    targetIdx = Math.max(0, Math.min(len - 1, low));
  }

  const col = columns[targetIdx];
  const colStart = col.startDate.getTime();
  const colEnd = col.endDate.getTime();
  const span = Math.max(1, colEnd - colStart);
  const frac = Math.min(1, Math.max(0, (time - colStart) / span));

  let x = targetIdx * col.width + frac * col.width;
  if (isEnd) {
    x = Math.max(x, targetIdx * col.width + col.width);
  }

  return x;
}

/**
 * Checks if adding a directed dependency fromId -> toId would create a cycle.
 * In a DAG, adding fromId -> toId creates a cycle if and only if toId can already reach fromId.
 * Runs in O(V + E) time via BFS.
 */
export function wouldCauseCycle(
  fromId: string,
  toId: string,
  existingEdges: CpmEdge[]
): boolean {
  if (fromId === toId) return true;

  // Build adjacency list: node -> array of neighbors
  const adj = new Map<string, string[]>();
  for (const edge of existingEdges) {
    if (edge.fromId === edge.toId) continue;
    const list = adj.get(edge.fromId) || [];
    list.push(edge.toId);
    adj.set(edge.fromId, list);
  }

  // BFS from toId to see if we can reach fromId
  const queue: string[] = [toId];
  const visited = new Set<string>([toId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === fromId) return true;

    const neighbors = adj.get(current) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return false;
}
