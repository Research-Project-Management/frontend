'use client';

/**
 * CollaborativeDiagramModal.tsx
 *
 * Collaborative Infinite Diagram Canvas with real-time CRDT sync
 * and instant LaTeX TikZ code generation (Overleaf + Excalidraw Parity).
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Square,
  Circle,
  Diamond,
  Database,
  Cloud,
  Type,
  ArrowRight,
  MousePointer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  Check,
  Code2,
  Trash2,
  Network,
  Download,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import type * as Y from 'yjs';
import type { CanvasElement, CanvasShapeType } from '@/features/editor/domain/canvas/canvas-types';
import {
  useCollaborativeDiagram,
  type CanvasTool,
} from './useCollaborativeDiagram';
import { screenToWorld, worldToScreen } from '@/features/editor/domain/canvas/quad-tree';

export interface CollaborativeDiagramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (tikzLatexCode: string) => void;
  yDoc?: Y.Doc | null;
  projectId?: string;
}

export function CollaborativeDiagramModal({
  open,
  onOpenChange,
  onInsert,
  yDoc,
}: CollaborativeDiagramModalProps) {
  const {
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
  } = useCollaborativeDiagram({ yDoc });

  const [activeTab, setActiveTab] = useState<'canvas' | 'tikz'>('canvas');
  const [copied, setCopied] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const elementDragStartRef = useRef<{ id: string; origX: number; origY: number } | null>(null);

  // Resize canvas container observer
  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setViewport((prev) => ({
        ...prev,
        width: rect.width,
        height: rect.height,
      }));
    }
  }, [open, setViewport]);

  const handleCopyTikZ = () => {
    navigator.clipboard.writeText(tikzCode);
    setCopied(true);
    toast.success('TikZ code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertTikZ = () => {
    onInsert(tikzCode);
    toast.success('Inserted TikZ diagram into LaTeX document!');
    onOpenChange(false);
  };

  // Zoom handlers
  const handleZoom = (delta: number) => {
    setViewport((prev) => {
      const nextZoom = Math.min(3.0, Math.max(0.2, prev.zoom + delta));
      return { ...prev, zoom: nextZoom };
    });
  };

  const handleResetView = () => {
    setViewport((prev) => ({ ...prev, zoom: 1, panX: 0, panY: 0 }));
  };

  // Canvas pointer interactions
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.target !== containerRef.current && (e.target as HTMLElement).tagName !== 'svg') {
      return;
    }

    if (e.button === 1 || activeTool === 'select') {
      // Pan canvas
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX - viewport.panX, y: e.clientY - viewport.panY };
      return;
    }

    // Creating a new shape at clicked position
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld({ x: screenX, y: screenY }, viewport);

    if (activeTool !== 'arrow') {
      const newEl: CanvasElement = {
        id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: activeTool,
        x: Math.round(world.x - 50),
        y: Math.round(world.y - 30),
        width: activeTool === 'diamond' ? 80 : activeTool === 'text' ? 100 : 120,
        height: activeTool === 'diamond' ? 70 : activeTool === 'text' ? 40 : 60,
        text: activeTool === 'text' ? 'Text' : activeTool.charAt(0).toUpperCase() + activeTool.slice(1),
        fillColor: '#3b82f6',
        strokeColor: '#000000',
        strokeWidth: 1.5,
        updatedAt: Date.now(),
      };
      addElement(newEl);
      setSelectedId(newEl.id);
      setActiveTool('select');
    } else {
      setSelectedId(null);
      setConnectingSourceId(null);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      setViewport((prev) => ({
        ...prev,
        panX: e.clientX - dragStartRef.current.x,
        panY: e.clientY - dragStartRef.current.y,
      }));
    } else if (elementDragStartRef.current) {
      const dragInfo = elementDragStartRef.current;
      const dx = (e.clientX - dragStartRef.current.x) / viewport.zoom;
      const dy = (e.clientY - dragStartRef.current.y) / viewport.zoom;
      updateElement(dragInfo.id, {
        x: Math.round(dragInfo.origX + dx),
        y: Math.round(dragInfo.origY + dy),
      });
    }
  };

  const handleCanvasPointerUp = () => {
    isDraggingRef.current = false;
    elementDragStartRef.current = null;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setViewport((prev) => {
      const nextZoom = Math.min(3.0, Math.max(0.2, prev.zoom * zoomFactor));
      return { ...prev, zoom: nextZoom };
    });
  };

  // Node Click handler
  const handleElementPointerDown = (e: React.PointerEvent, el: CanvasElement) => {
    e.stopPropagation();

    if (activeTool === 'arrow') {
      if (!connectingSourceId) {
        setConnectingSourceId(el.id);
        toast.info('Selected source. Now click target element to connect.');
      } else if (connectingSourceId !== el.id) {
        const newArrow: CanvasElement = {
          id: `arrow_${Date.now()}`,
          type: 'arrow',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          sourceElementId: connectingSourceId,
          targetElementId: el.id,
          arrowEnd: true,
          updatedAt: Date.now(),
        };
        addElement(newArrow);
        setConnectingSourceId(null);
        setActiveTool('select');
        toast.success('Connected elements!');
      }
      return;
    }

    setSelectedId(el.id);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    elementDragStartRef.current = { id: el.id, origX: el.x, origY: el.y };
  };

  const handleDoubleClickElement = (el: CanvasElement) => {
    setEditingTextId(el.id);
    setEditingTextValue(el.text || '');
  };

  const handleSaveText = () => {
    if (editingTextId) {
      updateElement(editingTextId, { text: editingTextValue });
      setEditingTextId(null);
    }
  };

  // Keybindings (Delete key)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingTextId) {
        removeElement(selectedId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, editingTextId, removeElement]);

  const selectedElement = elements.find((el) => el.id === selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[94vw] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        {/* Header Bar */}
        <DialogHeader className="p-3 sm:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Network className="size-4 text-primary" />
              Collaborative Diagram & TikZ Canvas
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Multi-user visual diagramming with spatial QuadTree culling & instant LaTeX TikZ transpilation.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pr-8 sm:pr-10 shrink-0">
            <div className="flex items-center rounded-md bg-muted p-0.5 border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('canvas')}
                className={cn(
                  'text-xs px-3 py-1 rounded font-medium transition-colors cursor-pointer',
                  activeTab === 'canvas'
                    ? 'bg-background text-foreground border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Canvas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tikz')}
                className={cn(
                  'text-xs px-3 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                  activeTab === 'tikz'
                    ? 'bg-background text-foreground border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Code2 className="size-3.5" />
                TikZ Code
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyTikZ}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy TikZ'}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleInsertTikZ}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <Download className="size-3.5" />
              Insert into LaTeX
            </Button>
          </div>
        </DialogHeader>

        {/* Workspace Body */}
        {activeTab === 'canvas' ? (
          <div className="flex-1 flex flex-col min-h-0 relative">
            {/* Top Toolbar */}
            <div className="h-10 px-3 bg-muted/40 border-b border-border flex items-center justify-between select-none overflow-x-auto overflow-y-hidden scrollbar-none gap-2">
              {/* Tool Selection */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant={activeTool === 'select' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8 relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => setActiveTool('select')}
                  title="Select / Move Tool"
                >
                  <MousePointer className="size-4" />
                </Button>
                <div className="w-[1px] h-4 bg-border mx-1" />
                <Button
                  variant={activeTool === 'rectangle' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8 relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => setActiveTool('rectangle')}
                  title="Rectangle"
                >
                  <Square className="size-4" />
                </Button>
                <Button
                  variant={activeTool === 'ellipse' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8 relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => setActiveTool('ellipse')}
                  title="Ellipse / Circle"
                >
                  <Circle className="size-4" />
                </Button>
                <Button
                  variant={activeTool === 'diamond' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8 relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => setActiveTool('diamond')}
                  title="Diamond (Decision)"
                >
                  <Diamond className="size-4" />
                </Button>
                <Button
                  variant={activeTool === 'database' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8 relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => setActiveTool('database')}
                  title="Database / Cylinder"
                >
                  <Database className="size-4" />
                </Button>
                <Button
                  variant={activeTool === 'cloud' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8 relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => setActiveTool('cloud')}
                  title="Cloud / External API"
                >
                  <Cloud className="size-4" />
                </Button>
                <Button
                  variant={activeTool === 'text' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8 relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => setActiveTool('text')}
                  title="Text Label"
                >
                  <Type className="size-4" />
                </Button>
                <div className="w-[1px] h-4 bg-border mx-1" />
                <Button
                  variant={activeTool === 'arrow' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="size-8 relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => setActiveTool('arrow')}
                  title="Arrow Connector"
                >
                  <ArrowRight className="size-4" />
                </Button>
              </div>

              {/* Presets & Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground mr-1">Presets:</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[28px] h-7 text-[11px] px-2 relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => loadPreset('transformer')}
                >
                  Transformer Attention
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[28px] h-7 text-[11px] px-2 relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => loadPreset('pipeline')}
                >
                  ML Pipeline
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[28px] h-7 text-[11px] px-2 relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => loadPreset('flowchart')}
                >
                  Flowchart
                </Button>

                <div className="w-[1px] h-4 bg-border mx-1" />

                {/* Zoom controls */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 relative after:absolute after:-inset-1.5 after:content-['']"
                  onClick={() => handleZoom(-0.1)}
                  title="Zoom Out"
                >
                  <ZoomOut className="size-3.5" />
                </Button>
                <span className="text-xs font-mono tabular-nums text-muted-foreground w-10 text-center">
                  {Math.round(viewport.zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 relative after:absolute after:-inset-1.5 after:content-['']"
                  onClick={() => handleZoom(0.1)}
                  title="Zoom In"
                >
                  <ZoomIn className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 relative after:absolute after:-inset-1.5 after:content-['']"
                  onClick={handleResetView}
                  title="Reset View"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive relative after:absolute after:-inset-1.5 after:content-['']"
                  onClick={clearCanvas}
                  title="Clear Canvas"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* SVG Infinite Canvas Viewport */}
            <div
              ref={containerRef}
              className="flex-1 overflow-hidden relative cursor-crosshair bg-background select-none"
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onWheel={handleWheel}
            >
              <svg
                className="w-full h-full absolute inset-0 pointer-events-none"
                style={{ overflow: 'visible' }}
              >
                <defs>
                  {/* Subtle Grid Pattern */}
                  <pattern
                    id="canvas-grid"
                    width={20 * viewport.zoom}
                    height={20 * viewport.zoom}
                    patternUnits="userSpaceOnUse"
                    x={viewport.panX % (20 * viewport.zoom)}
                    y={viewport.panY % (20 * viewport.zoom)}
                  >
                    <circle
                      cx={1 * viewport.zoom}
                      cy={1 * viewport.zoom}
                      r={1 * viewport.zoom}
                      fill="var(--border)"
                      opacity={0.6}
                    />
                  </pattern>

                  {/* Arrow markers */}
                  <marker
                    id="tikz-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--foreground)" />
                  </marker>
                  <marker
                    id="tikz-arrow-selected"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#3b82f6" />
                  </marker>
                </defs>

                <rect width="100%" height="100%" fill="url(#canvas-grid)" />

                {/* Render Connectors / Arrows first so nodes sit on top */}
                {visibleElements
                  .filter((el) => el.type === 'arrow')
                  .map((arrow) => {
                    const src = elements.find((e) => e.id === arrow.sourceElementId);
                    const tgt = elements.find((e) => e.id === arrow.targetElementId);
                    if (!src || !tgt) return null;

                    const srcCenter = worldToScreen(
                      { x: src.x + src.width / 2, y: src.y + src.height / 2 },
                      viewport
                    );
                    const tgtCenter = worldToScreen(
                      { x: tgt.x + tgt.width / 2, y: tgt.y + tgt.height / 2 },
                      viewport
                    );

                    const isSelected = selectedId === arrow.id;

                    return (
                      <g key={arrow.id} className="pointer-events-auto cursor-pointer" onClick={() => setSelectedId(arrow.id)}>
                        <line
                          x1={srcCenter.x}
                          y1={srcCenter.y}
                          x2={tgtCenter.x}
                          y2={tgtCenter.y}
                          stroke={isSelected ? '#3b82f6' : 'var(--foreground)'}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          strokeDasharray={arrow.strokeStyle === 'dashed' ? '5,5' : undefined}
                          markerEnd={isSelected ? 'url(#tikz-arrow-selected)' : 'url(#tikz-arrow)'}
                        />
                        {arrow.text && (
                          <text
                            x={(srcCenter.x + tgtCenter.x) / 2}
                            y={(srcCenter.y + tgtCenter.y) / 2 - 8}
                            fill="var(--foreground)"
                            fontSize={11 * viewport.zoom}
                            textAnchor="middle"
                            className="select-none font-medium"
                          >
                            {arrow.text}
                          </text>
                        )}
                      </g>
                    );
                  })}

                {/* Render Nodes */}
                {visibleElements
                  .filter((el) => el.type !== 'arrow')
                  .map((el) => {
                    const screenPos = worldToScreen({ x: el.x, y: el.y }, viewport);
                    const screenW = el.width * viewport.zoom;
                    const screenH = el.height * viewport.zoom;
                    const isSelected = selectedId === el.id;
                    const isConnecting = connectingSourceId === el.id;

                    return (
                      <g
                        key={el.id}
                        className="pointer-events-auto cursor-move"
                        onPointerDown={(e) => handleElementPointerDown(e, el)}
                        onDoubleClick={() => handleDoubleClickElement(el)}
                      >
                        {/* Shape representation */}
                        {el.type === 'rectangle' && (
                          <rect
                            x={screenPos.x}
                            y={screenPos.y}
                            width={screenW}
                            height={screenH}
                            rx={4 * viewport.zoom}
                            fill={el.fillColor || '#3b82f6'}
                            fillOpacity={0.2}
                            stroke={isSelected ? '#3b82f6' : isConnecting ? '#10b981' : 'var(--foreground)'}
                            strokeWidth={isSelected || isConnecting ? 2.5 : 1.5}
                          />
                        )}

                        {el.type === 'ellipse' && (
                          <ellipse
                            cx={screenPos.x + screenW / 2}
                            cy={screenPos.y + screenH / 2}
                            rx={screenW / 2}
                            ry={screenH / 2}
                            fill={el.fillColor || '#10b981'}
                            fillOpacity={0.2}
                            stroke={isSelected ? '#3b82f6' : isConnecting ? '#10b981' : 'var(--foreground)'}
                            strokeWidth={isSelected || isConnecting ? 2.5 : 1.5}
                          />
                        )}

                        {el.type === 'diamond' && (
                          <polygon
                            points={`
                              ${screenPos.x + screenW / 2},${screenPos.y}
                              ${screenPos.x + screenW},${screenPos.y + screenH / 2}
                              ${screenPos.x + screenW / 2},${screenPos.y + screenH}
                              ${screenPos.x},${screenPos.y + screenH / 2}
                            `}
                            fill={el.fillColor || '#f59e0b'}
                            fillOpacity={0.2}
                            stroke={isSelected ? '#3b82f6' : isConnecting ? '#10b981' : 'var(--foreground)'}
                            strokeWidth={isSelected || isConnecting ? 2.5 : 1.5}
                          />
                        )}

                        {el.type === 'database' && (
                          <g>
                            <rect
                              x={screenPos.x}
                              y={screenPos.y + 6 * viewport.zoom}
                              width={screenW}
                              height={screenH - 12 * viewport.zoom}
                              fill={el.fillColor || '#06b6d4'}
                              fillOpacity={0.2}
                              stroke="none"
                            />
                            <ellipse
                              cx={screenPos.x + screenW / 2}
                              cy={screenPos.y + screenH - 6 * viewport.zoom}
                              rx={screenW / 2}
                              ry={6 * viewport.zoom}
                              fill={el.fillColor || '#06b6d4'}
                              fillOpacity={0.2}
                              stroke={isSelected ? '#3b82f6' : 'var(--foreground)'}
                              strokeWidth={isSelected ? 2.5 : 1.5}
                            />
                            <line
                              x1={screenPos.x}
                              y1={screenPos.y + 6 * viewport.zoom}
                              x2={screenPos.x}
                              y2={screenPos.y + screenH - 6 * viewport.zoom}
                              stroke={isSelected ? '#3b82f6' : 'var(--foreground)'}
                              strokeWidth={isSelected ? 2.5 : 1.5}
                            />
                            <line
                              x1={screenPos.x + screenW}
                              y1={screenPos.y + 6 * viewport.zoom}
                              x2={screenPos.x + screenW}
                              y2={screenPos.y + screenH - 6 * viewport.zoom}
                              stroke={isSelected ? '#3b82f6' : 'var(--foreground)'}
                              strokeWidth={isSelected ? 2.5 : 1.5}
                            />
                            <ellipse
                              cx={screenPos.x + screenW / 2}
                              cy={screenPos.y + 6 * viewport.zoom}
                              rx={screenW / 2}
                              ry={6 * viewport.zoom}
                              fill={el.fillColor || '#06b6d4'}
                              fillOpacity={0.25}
                              stroke={isSelected ? '#3b82f6' : 'var(--foreground)'}
                              strokeWidth={isSelected ? 2.5 : 1.5}
                            />
                          </g>
                        )}

                        {el.type === 'cloud' && (
                          <rect
                            x={screenPos.x}
                            y={screenPos.y}
                            width={screenW}
                            height={screenH}
                            rx={screenH / 2}
                            fill={el.fillColor || '#10b981'}
                            fillOpacity={0.2}
                            stroke={isSelected ? '#3b82f6' : 'var(--foreground)'}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                          />
                        )}

                        {/* Text Label */}
                        <text
                          x={screenPos.x + screenW / 2}
                          y={screenPos.y + screenH / 2 + 4 * viewport.zoom}
                          fill="var(--foreground)"
                          fontSize={Math.max(10, 12 * viewport.zoom)}
                          textAnchor="middle"
                          className="font-medium select-none pointer-events-none"
                        >
                          {el.text}
                        </text>

                        {/* Selection Bounding Ring */}
                        {isSelected && (
                          <rect
                            x={screenPos.x - 3}
                            y={screenPos.y - 3}
                            width={screenW + 6}
                            height={screenH + 6}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="1"
                            strokeDasharray="4,4"
                          />
                        )}
                      </g>
                    );
                  })}
              </svg>

              {/* Inline Text Edit Dialog/Input */}
              {editingTextId && (
                <div
                  className="absolute bg-background p-2 rounded-md shadow-lg border border-border flex items-center gap-2 z-50"
                  style={{
                    left: `${worldToScreen(selectedElement || { x: 100, y: 100 }, viewport).x}px`,
                    top: `${worldToScreen(selectedElement || { x: 100, y: 100 }, viewport).y - 45}px`,
                  }}
                >
                  <Input
                    autoFocus
                    value={editingTextValue}
                    onChange={(e) => setEditingTextValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveText();
                      if (e.key === 'Escape') setEditingTextId(null);
                    }}
                    placeholder="Enter label..."
                    className="h-8 text-xs w-48"
                  />
                  <Button size="sm" onClick={handleSaveText} className="h-8 text-xs">
                    Save
                  </Button>
                </div>
              )}
            </div>

            {/* Bottom Status & Info Bar */}
            <div className="h-7 px-3 bg-muted/20 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3 font-mono">
                <span>{elements.length} elements</span>
                <span>•</span>
                <span>{visibleElements.length} visible (QuadTree)</span>
                {selectedElement && (
                  <>
                    <span>•</span>
                    <span className="text-foreground font-semibold">
                      Selected: [{selectedElement.type}] {selectedElement.text || selectedElement.id}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span>Double-click element to edit text</span>
                <span>•</span>
                <span>Press Delete to remove</span>
              </div>
            </div>
          </div>
        ) : (
          /* Live TikZ Code View */
          <div className="flex-1 flex flex-col min-h-0 bg-muted/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Code2 className="size-4 text-primary" />
                Live Generated LaTeX TikZ AST
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {tikzCode.split('\n').length} lines
              </span>
            </div>
            <pre className="flex-1 overflow-auto p-4 rounded-md bg-background border border-border font-mono text-xs text-foreground select-text leading-relaxed">
              {tikzCode}
            </pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
export default CollaborativeDiagramModal;
