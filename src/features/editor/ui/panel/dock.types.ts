/**
 * dock.types.ts
 *
 * Shared data structures and contracts for Bottom Dock Panel (Layer 6: UI Layer).
 * Decouples DockOutputTab from BottomDockPanel to maintain an acyclic dependency graph.
 */

export interface ParsedLogLine {
  text: string;
  originalIndex: number;
  type: 'error' | 'warning' | 'info' | 'success' | 'asset' | 'normal';
  jumpLine?: number;
}
