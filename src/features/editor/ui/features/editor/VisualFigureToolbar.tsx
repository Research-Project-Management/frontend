'use client';

/**
 * VisualFigureToolbar.tsx
 *
 * Floating Interactive Figure Toolbar for Visual LaTeX Editor Mode (Overleaf Parity).
 * Location: `features/editor/ui/features/editor/VisualFigureToolbar.tsx`
 *
 * Capabilities:
 * - Scale & Width presets (25%, 50%, 75%, 100%, \textwidth)
 * - Alignment toggle (\centering)
 * - Multi-column span toggle (\begin{figure*} vs \begin{figure})
 * - Edit Caption and Label (\caption{...}, \label{...})
 * - Asset image path selection & quick file picker
 * - Delete entire Figure with 1-click
 */

import React, { useState } from 'react';
import {
  Image as ImageIcon,
  AlignCenter,
  Columns,
  Trash2,
  Settings2,
  Check,
  X,
  Tag,
  FileText,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';

export interface VisualFigureToolbarProps {
  position: { top: number; left: number };
  src: string;
  width: string;
  caption: string;
  label: string;
  isCentering: boolean;
  isStarred: boolean;
  projectImageFiles?: string[];
  onChangeWidth: (newWidth: string) => void;
  onChangeImage: (newSrc: string) => void;
  onUpdateMetadata: (caption: string, label: string) => void;
  onToggleCentering: () => void;
  onToggleStarred: () => void;
  onDeleteFigure: () => void;
  onClose: () => void;
}

const WIDTH_PRESETS = [
  { spec: '0.25\\linewidth', label: '25%' },
  { spec: '0.5\\linewidth', label: '50%' },
  { spec: '0.75\\linewidth', label: '75%' },
  { spec: '1.0\\linewidth', label: '100%' },
  { spec: '\\textwidth', label: 'Full' },
];

export function VisualFigureToolbar({
  position,
  src,
  width,
  caption = '',
  label = '',
  isCentering = true,
  isStarred = false,
  projectImageFiles = [],
  onChangeWidth,
  onChangeImage,
  onUpdateMetadata,
  onToggleCentering,
  onToggleStarred,
  onDeleteFigure,
  onClose,
}: VisualFigureToolbarProps) {
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  const [editCaption, setEditCaption] = useState(caption);
  const [editLabel, setEditLabel] = useState(label);
  const [editSrc, setEditSrc] = useState(src);

  const handleApplyMetadata = () => {
    onUpdateMetadata(editCaption, editLabel);
    setShowMetadataForm(false);
  };

  const handleApplyImageSrc = () => {
    if (editSrc.trim()) {
      onChangeImage(editSrc.trim());
      setShowImagePicker(false);
    }
  };

  const filename = src.split('/').pop() || src || 'graphic.png';

  return (
    <div
      role="toolbar"
      aria-label="Figure Floating Toolbar"
      className={cn(
        'fixed z-50 flex flex-col items-start bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-xl p-1.5 transition-all text-xs text-foreground select-none',
        'animate-in fade-in zoom-in-95 duration-150'
      )}
      style={{
        top: `${Math.max(10, position.top)}px`,
        left: `${Math.max(10, position.left)}px`,
      }}
      onMouseDown={(e) => {
        // Prevent blurring selection
        e.preventDefault();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Main Action Bar ── */}
      <div className="flex items-center gap-1 w-full flex-wrap sm:flex-nowrap">
        {/* Figure Asset Name Badge / Picker Trigger */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 hover:bg-muted/80 rounded-lg text-foreground/90 mr-1 text-[11px] font-mono cursor-pointer transition-colors"
          onClick={() => {
            setShowImagePicker((prev) => !prev);
            setShowMetadataForm(false);
          }}
          title="Click to change image asset"
          role="button"
          aria-label={`Image asset: ${filename}`}
        >
          <ImageIcon className="size-3.5 text-primary" />
          <span className="max-w-[110px] truncate">{filename}</span>
          <FolderOpen className="size-3 text-muted-foreground ml-0.5" />
        </div>

        <div className="w-[1px] h-4 bg-border/80 my-auto mx-0.5" />

        {/* Width Scaling Presets */}
        <div className="flex items-center gap-0.5" title="Figure Width Scaling">
          {WIDTH_PRESETS.map((preset) => {
            const isActive = width.includes(preset.spec.replace('\\', '')) || width === preset.spec;
            return (
              <Button
                key={preset.spec}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-1.5 text-[11px] font-mono rounded-lg cursor-pointer transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary font-bold shadow-xs'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onChangeWidth(preset.spec)}
                title={`Scale to ${preset.label} (${preset.spec})`}
                aria-label={`Width ${preset.label}`}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>

        <div className="w-[1px] h-4 bg-border/80 my-auto mx-0.5" />

        {/* Alignment & Column Span Controls */}
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'size-7 rounded-lg cursor-pointer transition-colors',
              isCentering
                ? 'bg-primary/15 text-primary'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            )}
            onClick={onToggleCentering}
            title={isCentering ? 'Centering: ON (\\centering)' : 'Centering: OFF'}
            aria-label="Toggle centering"
          >
            <AlignCenter className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'size-7 rounded-lg cursor-pointer transition-colors',
              isStarred
                ? 'bg-primary/15 text-primary font-bold'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            )}
            onClick={onToggleStarred}
            title={isStarred ? 'Two-Column Span: ON (\\begin{figure*})' : 'Two-Column Span: OFF (\\begin{figure})'}
            aria-label="Toggle two-column span"
          >
            <Columns className="size-3.5" />
          </Button>
        </div>

        <div className="w-[1px] h-4 bg-border/80 my-auto mx-0.5" />

        {/* Caption & Label Settings Toggle */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'size-7 rounded-lg cursor-pointer transition-colors',
            showMetadataForm
              ? 'bg-primary/15 text-primary'
              : Boolean(caption || label)
              ? 'text-primary hover:bg-muted'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          )}
          onClick={() => {
            setShowMetadataForm((prev) => !prev);
            setShowImagePicker(false);
          }}
          title="Edit Caption & Label (\caption, \label)"
          aria-label="Edit figure caption and label"
        >
          <Settings2 className="size-3.5" />
        </Button>

        {/* Delete Figure */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
          onClick={onDeleteFigure}
          title="Delete Figure"
          aria-label="Delete figure"
        >
          <Trash2 className="size-3.5" />
        </Button>

        {/* Close Toolbar */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer ml-auto"
          onClick={onClose}
          title="Close Toolbar"
          aria-label="Close toolbar"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* ── Metadata Drawer (Caption & Label Editor) ── */}
      {showMetadataForm && (
        <div
          className="w-full mt-2 pt-2 border-t border-border/80 flex flex-col gap-2 animate-in fade-in duration-100"
          role="region"
          aria-label="Figure Metadata Editor"
        >
          <div className="flex items-center gap-1.5">
            <FileText className="size-3 text-muted-foreground shrink-0" />
            <Input
              type="text"
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              placeholder="Caption (e.g. Model architecture overview)..."
              className="h-7 text-xs bg-background/80 flex-1 font-sans"
              aria-label="Figure caption input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyMetadata();
              }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Tag className="size-3 text-muted-foreground shrink-0" />
            <Input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="Label (e.g. fig:arch)..."
              className="h-7 text-xs bg-background/80 flex-1 font-mono"
              aria-label="Figure label input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyMetadata();
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1 cursor-pointer"
              onClick={handleApplyMetadata}
              aria-label="Save metadata"
            >
              <Check className="size-3" />
              <span>Apply</span>
            </Button>
          </div>
        </div>
      )}

      {/* ── Image Picker Drawer ── */}
      {showImagePicker && (
        <div
          className="w-full mt-2 pt-2 border-t border-border/80 flex flex-col gap-2 animate-in fade-in duration-100"
          role="region"
          aria-label="Figure Image Picker"
        >
          <div className="flex items-center gap-1.5">
            <Input
              type="text"
              value={editSrc}
              onChange={(e) => setEditSrc(e.target.value)}
              placeholder="Path (e.g. figures/diagram.png)..."
              className="h-7 text-xs bg-background/80 flex-1 font-mono"
              aria-label="Image source path input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyImageSrc();
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1 cursor-pointer"
              onClick={handleApplyImageSrc}
              aria-label="Apply image path"
            >
              <Check className="size-3" />
              <span>Set</span>
            </Button>
          </div>

          {projectImageFiles.length > 0 && (
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pt-1">
              <span className="text-[11px] text-muted-foreground font-semibold px-1">Project Images:</span>
              <div className="flex flex-wrap gap-1">
                {projectImageFiles.map((imgPath) => (
                  <button
                    key={imgPath}
                    type="button"
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer text-left truncate max-w-[180px]"
                    onClick={() => {
                      setEditSrc(imgPath);
                      onChangeImage(imgPath);
                      setShowImagePicker(false);
                    }}
                    title={imgPath}
                  >
                    {imgPath.split('/').pop()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default VisualFigureToolbar;
