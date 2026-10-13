/**
 * canvas-types.ts
 *
 * Domain types for Collaborative Infinite Diagram Canvas & LaTeX TikZ Generation.
 */

export type CanvasShapeType =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'text'
  | 'arrow'
  | 'database'
  | 'cloud';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasElement {
  id: string;
  type: CanvasShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  // Arrow / Connector specific properties
  sourceElementId?: string;
  targetElementId?: string;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  points?: Point[];
  // Typography
  fontSize?: number;
  fontColor?: string;
  zIndex?: number;
  updatedAt: number;
  updatedBy?: string;
}

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  width: number;
  height: number;
}

export interface TikZExportOptions {
  scale?: number; // pixels to cm scale factor (default: 40px = 1cm)
  includeDocumentWrapper?: boolean; // wrap in \documentclass and \begin{document}
  compact?: boolean;
  coordinateOrigin?: 'top-left' | 'center';
  colorPalette?: Record<string, string>; // hex to xcolor name mapping
}
