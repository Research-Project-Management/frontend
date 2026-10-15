'use client';

/**
 * useCollaborativeDiagram.ts
 *
 * Hook managing infinite visual canvas state, QuadTree spatial culling,
 * interactive shape creation, presets, and real-time CRDT synchronization.
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type * as Y from 'yjs';
import type {
  CanvasElement,
  CanvasShapeType,
  ViewportState,
  BoundingBox,
  Point,
} from '@/features/editor/domain/canvas/canvas-types';
import {
  QuadTree,
  screenToWorld,
  worldToScreen,
  getViewportWorldBounds,
} from '@/features/editor/domain/canvas/quad-tree';
import { TikZTranspiler } from '@/features/editor/domain/canvas/tikz-transpiler';

export type CanvasTool = 'select' | CanvasShapeType;

export interface UseCollaborativeDiagramOptions {
  yDoc?: Y.Doc | null;
  initialElements?: CanvasElement[];
}

export function useCollaborativeDiagram({
  yDoc,
  initialElements = [],
}: UseCollaborativeDiagramOptions = {}) {
  const [elements, setElements] = useState<CanvasElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [viewport, setViewport] = useState<ViewportState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    width: 800,
    height: 500,
  });

  // Connecting arrow state
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);

  // Sync with Yjs Map if provided
  const yMap = useMemo(() => {
    return yDoc ? yDoc.getMap<CanvasElement>('canvas:diagram') : null;
  }, [yDoc]);

  const initialElementsRef = useRef(initialElements);
  initialElementsRef.current = initialElements;

  useEffect(() => {
    if (!yMap) return;

    // Load initial from Y.Map
    if (yMap.size > 0) {
      setElements(Array.from(yMap.values()));
    } else if (initialElementsRef.current.length > 0) {
      yDoc?.transact(() => {
        initialElementsRef.current.forEach((el) => yMap.set(el.id, el));
      }, 'init-canvas');
    }

    const observer = () => {
      setElements(Array.from(yMap.values()));
    };

    yMap.observe(observer);
    return () => {
      yMap.unobserve(observer);
    };
  }, [yMap, yDoc]);

  // Construct QuadTree for spatial indexing & viewport culling
  const quadTree = useMemo(() => {
    const tree = new QuadTree<CanvasElement>(
      { x: -50000, y: -50000, width: 100000, height: 100000 },
      16,
      8
    );
    for (const el of elements) {
      tree.insert(el);
    }
    return tree;
  }, [elements]);

  // Viewport visible elements (culling elements outside current view bounds)
  const visibleElements = useMemo(() => {
    if (elements.length <= 50) return elements; // Bypass for tiny diagrams
    const worldBounds = getViewportWorldBounds(viewport);
    return quadTree.queryRange(worldBounds);
  }, [quadTree, viewport, elements]);

  // Generated TikZ LaTeX code
  const tikzCode = useMemo(() => {
    return TikZTranspiler.transpile(elements, { scale: 40 });
  }, [elements]);

  // Mutators (with dual local state + Yjs CRDT broadcast)
  const addElement = useCallback(
    (element: CanvasElement) => {
      setElements((prev) => [...prev, element]);
      if (yMap) {
        yMap.set(element.id, element);
      }
    },
    [yMap]
  );

  const updateElement = useCallback(
    (id: string, updates: Partial<CanvasElement>) => {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== id) return el;
          const updated = { ...el, ...updates, updatedAt: Date.now() };
          if (yMap) yMap.set(id, updated);
          return updated;
        })
      );
    },
    [yMap]
  );

  const removeElement = useCallback(
    (id: string) => {
      setElements((prev) =>
        prev.filter((el) => el.id !== id && el.sourceElementId !== id && el.targetElementId !== id)
      );
      if (selectedId === id) setSelectedId(null);
      if (yMap) {
        yDoc?.transact(() => {
          yMap.delete(id);
          // Also delete attached arrows
          for (const [key, val] of yMap.entries()) {
            if (val.sourceElementId === id || val.targetElementId === id) {
              yMap.delete(key);
            }
          }
        }, 'delete-element');
      }
    },
    [selectedId, yMap, yDoc]
  );

  const clearCanvas = useCallback(() => {
    setElements([]);
    setSelectedId(null);
    setConnectingSourceId(null);
    if (yMap) {
      yDoc?.transact(() => {
        const keys = Array.from(yMap.keys());
        keys.forEach((k) => yMap.delete(k));
      }, 'clear-canvas');
    }
  }, [yMap, yDoc]);

  // Load Presets
  const loadPreset = useCallback(
    (presetKey: 'transformer' | 'pipeline' | 'consensus' | 'flowchart') => {
      let presetItems: CanvasElement[] = [];

      if (presetKey === 'transformer') {
        presetItems = [
          {
            id: 'input-emb',
            type: 'rectangle',
            x: 80,
            y: 350,
            width: 140,
            height: 45,
            text: 'Input Embedding',
            fillColor: '#3b82f6',
            updatedAt: Date.now(),
          },
          {
            id: 'self-att',
            type: 'rectangle',
            x: 80,
            y: 250,
            width: 140,
            height: 50,
            text: 'Multi-Head Attention',
            fillColor: '#8b5cf6',
            updatedAt: Date.now(),
          },
          {
            id: 'norm-1',
            type: 'rectangle',
            x: 80,
            y: 170,
            width: 140,
            height: 40,
            text: 'Add & LayerNorm',
            fillColor: '#64748b',
            updatedAt: Date.now(),
          },
          {
            id: 'ffn',
            type: 'rectangle',
            x: 80,
            y: 80,
            width: 140,
            height: 50,
            text: 'Feed Forward Network',
            fillColor: '#10b981',
            updatedAt: Date.now(),
          },
          {
            id: 'out-linear',
            type: 'rectangle',
            x: 80,
            y: 0,
            width: 140,
            height: 45,
            text: 'Linear & Softmax',
            fillColor: '#f59e0b',
            updatedAt: Date.now(),
          },
          {
            id: 'a1',
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            sourceElementId: 'input-emb',
            targetElementId: 'self-att',
            updatedAt: Date.now(),
          },
          {
            id: 'a2',
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            sourceElementId: 'self-att',
            targetElementId: 'norm-1',
            updatedAt: Date.now(),
          },
          {
            id: 'a3',
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            sourceElementId: 'norm-1',
            targetElementId: 'ffn',
            updatedAt: Date.now(),
          },
          {
            id: 'a4',
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            sourceElementId: 'ffn',
            targetElementId: 'out-linear',
            updatedAt: Date.now(),
          },
        ];
      } else if (presetKey === 'pipeline') {
        presetItems = [
          {
            id: 'raw-data',
            type: 'database',
            x: 50,
            y: 100,
            width: 100,
            height: 70,
            text: 'Raw Telemetry',
            fillColor: '#06b6d4',
            updatedAt: Date.now(),
          },
          {
            id: 'cleaning',
            type: 'rectangle',
            x: 230,
            y: 105,
            width: 120,
            height: 60,
            text: 'ETL & Cleaning',
            fillColor: '#3b82f6',
            updatedAt: Date.now(),
          },
          {
            id: 'training',
            type: 'rectangle',
            x: 430,
            y: 105,
            width: 120,
            height: 60,
            text: 'Model Training',
            fillColor: '#8b5cf6',
            updatedAt: Date.now(),
          },
          {
            id: 'eval-cond',
            type: 'diamond',
            x: 630,
            y: 95,
            width: 90,
            height: 80,
            text: 'F1 >= 0.90?',
            fillColor: '#f59e0b',
            updatedAt: Date.now(),
          },
          {
            id: 'deploy',
            type: 'cloud',
            x: 800,
            y: 100,
            width: 110,
            height: 70,
            text: 'Production API',
            fillColor: '#10b981',
            updatedAt: Date.now(),
          },
          {
            id: 'p1',
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            sourceElementId: 'raw-data',
            targetElementId: 'cleaning',
            updatedAt: Date.now(),
          },
          {
            id: 'p2',
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            sourceElementId: 'cleaning',
            targetElementId: 'training',
            updatedAt: Date.now(),
          },
          {
            id: 'p3',
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            sourceElementId: 'training',
            targetElementId: 'eval-cond',
            updatedAt: Date.now(),
          },
          {
            id: 'p4',
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            sourceElementId: 'eval-cond',
            targetElementId: 'deploy',
            text: 'Yes',
            updatedAt: Date.now(),
          },
        ];
      } else if (presetKey === 'flowchart') {
        presetItems = [
          {
            id: 'start',
            type: 'ellipse',
            x: 200,
            y: 20,
            width: 100,
            height: 45,
            text: 'Start',
            fillColor: '#10b981',
            updatedAt: Date.now(),
          },
          {
            id: 'process',
            type: 'rectangle',
            x: 180,
            y: 120,
            width: 140,
            height: 50,
            text: 'Compute Matrix',
            fillColor: '#3b82f6',
            updatedAt: Date.now(),
          },
          {
            id: 'check',
            type: 'diamond',
            x: 200,
            y: 220,
            width: 100,
            height: 70,
            text: 'Valid?',
            fillColor: '#f59e0b',
            updatedAt: Date.now(),
          },
          {
            id: 'end',
            type: 'ellipse',
            x: 200,
            y: 340,
            width: 100,
            height: 45,
            text: 'End',
            fillColor: '#ef4444',
            updatedAt: Date.now(),
          },
          {
            id: 'f1',
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            sourceElementId: 'start',
            targetElementId: 'process',
            updatedAt: Date.now(),
          },
          {
            id: 'f2',
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            sourceElementId: 'process',
            targetElementId: 'check',
            updatedAt: Date.now(),
          },
          {
            id: 'f3',
            type: 'arrow',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            sourceElementId: 'check',
            targetElementId: 'end',
            text: 'Yes',
            updatedAt: Date.now(),
          },
        ];
      }

      setElements(presetItems);
      setSelectedId(null);
      if (yMap) {
        yDoc?.transact(() => {
          Array.from(yMap.keys()).forEach((k) => yMap.delete(k));
          presetItems.forEach((it) => yMap.set(it.id, it));
        }, 'preset-load');
      }
    },
    [yMap, yDoc]
  );

  return {
    elements,
    visibleElements,
    selectedId,
    setSelectedId,
    activeTool,
    setActiveTool,
    viewport,
    setViewport,
    connectingSourceId,
    setConnectingSourceId,
    tikzCode,
    addElement,
    updateElement,
    removeElement,
    clearCanvas,
    loadPreset,
  };
}
