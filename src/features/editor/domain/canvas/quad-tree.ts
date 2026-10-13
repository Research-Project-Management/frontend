/**
 * quad-tree.ts
 *
 * High-performance 2D Spatial QuadTree Index & Viewport Matrix Transformation.
 * Enables O(k + log N) spatial range queries and viewport culling for 10,000+ canvas items.
 */

import type { Point, BoundingBox, ViewportState } from './canvas-types';

export function boxIntersects(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function pointInBox(p: Point, b: BoundingBox): boolean {
  return (
    p.x >= b.x &&
    p.x <= b.x + b.width &&
    p.y >= b.y &&
    p.y <= b.y + b.height
  );
}

export function worldToScreen(worldPoint: Point, viewport: ViewportState): Point {
  return {
    x: worldPoint.x * viewport.zoom + viewport.panX,
    y: worldPoint.y * viewport.zoom + viewport.panY,
  };
}

export function screenToWorld(screenPoint: Point, viewport: ViewportState): Point {
  const safeZoom = viewport.zoom === 0 ? 1 : viewport.zoom;
  return {
    x: (screenPoint.x - viewport.panX) / safeZoom,
    y: (screenPoint.y - viewport.panY) / safeZoom,
  };
}

export function getViewportWorldBounds(viewport: ViewportState): BoundingBox {
  const topLeft = screenToWorld({ x: 0, y: 0 }, viewport);
  const bottomRight = screenToWorld(
    { x: viewport.width, y: viewport.height },
    viewport
  );

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: Math.max(0, bottomRight.x - topLeft.x),
    height: Math.max(0, bottomRight.y - topLeft.y),
  };
}

export interface QuadTreeItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class QuadTree<T extends QuadTreeItem> {
  private readonly bounds: BoundingBox;
  private readonly capacity: number;
  private readonly maxDepth: number;
  private readonly depth: number;

  private items: T[] = [];
  private divided: boolean = false;

  private northwest: QuadTree<T> | null = null;
  private northeast: QuadTree<T> | null = null;
  private southwest: QuadTree<T> | null = null;
  private southeast: QuadTree<T> | null = null;

  constructor(
    bounds: BoundingBox,
    capacity: number = 16,
    maxDepth: number = 8,
    depth: number = 0
  ) {
    this.bounds = bounds;
    this.capacity = capacity;
    this.maxDepth = maxDepth;
    this.depth = depth;
  }

  public getBounds(): BoundingBox {
    return this.bounds;
  }

  public insert(item: T): boolean {
    const itemBox: BoundingBox = {
      x: item.x,
      y: item.y,
      width: Math.max(1, item.width),
      height: Math.max(1, item.height),
    };

    if (!boxIntersects(this.bounds, itemBox)) {
      return false;
    }

    if (!this.divided) {
      if (this.items.length < this.capacity || this.depth >= this.maxDepth) {
        this.items.push(item);
        return true;
      }
      this.subdivide();
    }

    let inserted = false;
    if (this.northwest?.insert(item)) inserted = true;
    if (this.northeast?.insert(item)) inserted = true;
    if (this.southwest?.insert(item)) inserted = true;
    if (this.southeast?.insert(item)) inserted = true;

    return inserted;
  }

  public queryRange(range: BoundingBox, found?: Set<T>): T[] {
    const resultSet = found ?? new Set<T>();

    if (!boxIntersects(this.bounds, range)) {
      return Array.from(resultSet);
    }

    for (const item of this.items) {
      const itemBox: BoundingBox = {
        x: item.x,
        y: item.y,
        width: Math.max(1, item.width),
        height: Math.max(1, item.height),
      };
      if (boxIntersects(itemBox, range)) {
        resultSet.add(item);
      }
    }

    if (this.divided) {
      this.northwest?.queryRange(range, resultSet);
      this.northeast?.queryRange(range, resultSet);
      this.southwest?.queryRange(range, resultSet);
      this.southeast?.queryRange(range, resultSet);
    }

    return Array.from(resultSet);
  }

  public queryPoint(point: Point, found?: Set<T>): T[] {
    const pointBox: BoundingBox = {
      x: point.x,
      y: point.y,
      width: 0.001,
      height: 0.001,
    };
    return this.queryRange(pointBox, found);
  }

  public remove(itemId: string): boolean {
    let removed = false;
    const initialLen = this.items.length;
    this.items = this.items.filter((it) => it.id !== itemId);
    if (this.items.length < initialLen) {
      removed = true;
    }

    if (this.divided) {
      if (this.northwest?.remove(itemId)) removed = true;
      if (this.northeast?.remove(itemId)) removed = true;
      if (this.southwest?.remove(itemId)) removed = true;
      if (this.southeast?.remove(itemId)) removed = true;
    }

    return removed;
  }

  public clear(): void {
    this.items = [];
    if (this.divided) {
      this.northwest?.clear();
      this.northeast?.clear();
      this.southwest?.clear();
      this.southeast?.clear();
      this.northwest = null;
      this.northeast = null;
      this.southwest = null;
      this.southeast = null;
      this.divided = false;
    }
  }

  public size(): number {
    const set = new Set<string>();
    this.collectIds(set);
    return set.size;
  }

  private collectIds(set: Set<string>): void {
    for (const item of this.items) {
      set.add(item.id);
    }
    if (this.divided) {
      this.northwest?.collectIds(set);
      this.northeast?.collectIds(set);
      this.southwest?.collectIds(set);
      this.southeast?.collectIds(set);
    }
  }

  private subdivide(): void {
    const halfW = this.bounds.width / 2;
    const halfH = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;
    const nextDepth = this.depth + 1;

    this.northwest = new QuadTree<T>(
      { x, y, width: halfW, height: halfH },
      this.capacity,
      this.maxDepth,
      nextDepth
    );

    this.northeast = new QuadTree<T>(
      { x: x + halfW, y, width: halfW, height: halfH },
      this.capacity,
      this.maxDepth,
      nextDepth
    );

    this.southwest = new QuadTree<T>(
      { x, y: y + halfH, width: halfW, height: halfH },
      this.capacity,
      this.maxDepth,
      nextDepth
    );

    this.southeast = new QuadTree<T>(
      { x: x + halfW, y: y + halfH, width: halfW, height: halfH },
      this.capacity,
      this.maxDepth,
      nextDepth
    );

    this.divided = true;

    // Distribute existing items down into children
    const existing = this.items;
    this.items = [];
    for (const item of existing) {
      this.insert(item);
    }
  }
}
