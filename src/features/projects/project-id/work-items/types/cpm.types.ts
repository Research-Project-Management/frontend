export type CpmDependencyType = 'FS' | 'SS' | 'FF' | 'SF';

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
