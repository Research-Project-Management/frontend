/**
 * quad-tree.ts
 *
 * 2D Spatial QuadTree Index & Coordinate Transformations for Diagram Canvas Viewport Culling.
 */

import type { BoundingBox } from './canvas-types';

export interface SpatialItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  panX = 0,
  panY = 0,
  zoom = 1,
): { x: number; y: number } {
  const safeZoom = zoom || 1;
  return {
    x: (screenX - panX) / safeZoom,
    y: (screenY - panY) / safeZoom,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  panX = 0,
  panY = 0,
  zoom = 1,
): { x: number; y: number } {
  return {
    x: worldX * zoom + panX,
    y: worldY * zoom + panY,
  };
}

function intersects(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    b.x > a.x + a.width ||
    b.x + b.width < a.x ||
    b.y > a.y + a.height ||
    b.y + b.height < a.y
  );
}

export class QuadTree<T extends SpatialItem = SpatialItem> {
  private readonly bounds: BoundingBox;
  private readonly capacity: number;
  private readonly maxDepth: number;
  private readonly depth: number;
  private items: T[] = [];
  private divided = false;
  private nw?: QuadTree<T>;
  private ne?: QuadTree<T>;
  private sw?: QuadTree<T>;
  private se?: QuadTree<T>;
  private allItems?: Map<string, T>;

  constructor(bounds: BoundingBox, capacity = 8, maxDepth = 8, depth = 0, rootMap?: Map<string, T>) {
    this.bounds = bounds;
    this.capacity = capacity;
    this.maxDepth = maxDepth;
    this.depth = depth;
    this.allItems = rootMap ?? new Map<string, T>();
  }

  public insert(item: T): boolean {
    if (this.depth === 0 && this.allItems) {
      this.allItems.set(item.id, item);
    }

    const itemBox: BoundingBox = {
      x: item.x,
      y: item.y,
      width: Math.max(0, item.width),
      height: Math.max(0, item.height),
    };

    if (!intersects(this.bounds, itemBox)) {
      return false;
    }

    if (this.items.length < this.capacity || this.depth >= this.maxDepth) {
      this.items.push(item);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    this.nw!.insert(item);
    this.ne!.insert(item);
    this.sw!.insert(item);
    this.se!.insert(item);
    return true;
  }

  private subdivide(): void {
    const { x, y, width, height } = this.bounds;
    const hw = width / 2;
    const hh = height / 2;
    const nextDepth = this.depth + 1;

    this.nw = new QuadTree({ x, y, width: hw, height: hh }, this.capacity, this.maxDepth, nextDepth, this.allItems);
    this.ne = new QuadTree({ x: x + hw, y, width: hw, height: hh }, this.capacity, this.maxDepth, nextDepth, this.allItems);
    this.sw = new QuadTree({ x, y: y + hh, width: hw, height: hh }, this.capacity, this.maxDepth, nextDepth, this.allItems);
    this.se = new QuadTree({ x: x + hw, y: y + hh, width: hw, height: hh }, this.capacity, this.maxDepth, nextDepth, this.allItems);
    this.divided = true;
  }

  public queryRange(range: BoundingBox): T[] {
    const found = new Map<string, T>();
    this.queryRangeInternal(range, found);
    return Array.from(found.values());
  }

  private queryRangeInternal(range: BoundingBox, found: Map<string, T>): void {
    if (!intersects(this.bounds, range)) {
      return;
    }

    for (const item of this.items) {
      if (!found.has(item.id)) {
        const itemBox: BoundingBox = {
          x: item.x,
          y: item.y,
          width: Math.max(0, item.width),
          height: Math.max(0, item.height),
        };
        if (intersects(range, itemBox)) {
          found.set(item.id, item);
        }
      }
    }

    if (this.divided) {
      this.nw!.queryRangeInternal(range, found);
      this.ne!.queryRangeInternal(range, found);
      this.sw!.queryRangeInternal(range, found);
      this.se!.queryRangeInternal(range, found);
    }
  }

  public size(): number {
    return this.allItems ? this.allItems.size : this.items.length;
  }

  public clear(): void {
    this.items = [];
    this.divided = false;
    this.nw = undefined;
    this.ne = undefined;
    this.sw = undefined;
    this.se = undefined;
    this.allItems?.clear();
  }
}
