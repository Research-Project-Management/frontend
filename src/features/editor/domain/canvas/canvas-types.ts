/**
 * canvas-types.ts
 *
 * Domain Types for Collaborative Diagram Canvas & TikZ Transpilation.
 */

export type CanvasElementType =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'database'
  | 'arrow'
  | 'text';

export interface CanvasElement {
  id: string;
  type?: CanvasElementType | string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  sourceElementId?: string;
  targetElementId?: string;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  updatedAt?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
