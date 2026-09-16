'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Image as ImageIcon, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface InsertImageModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (snippet: string) => void;
}

const WIDTH_PRESETS = [
  { label: '50%', value: '0.5\\linewidth' },
  { label: '80%', value: '0.8\\linewidth' },
  { label: '100%', value: '1.0\\linewidth' },
  { label: 'Column', value: '\\columnwidth' },
  { label: 'Text Width', value: '0.8\\textwidth' },
];

export function InsertImageModal({
  open,
  onClose,
  onInsert,
}: InsertImageModalProps) {
  const [fileName, setFileName] = useState('figures/image.png');
  const [caption, setCaption] = useState('Figure Caption');
  const [label, setLabel] = useState('fig:my_figure');
  const [width, setWidth] = useState('0.8\\linewidth');
  const [placement, setPlacement] = useState('htbp');

  const handleInsert = () => {
    const snippet = `\\begin{figure}[${placement}]
  \\centering
  \\includegraphics[width=${width}]{${fileName}}
  \\caption{${caption}}
  \\label{${label}}
\\end{figure}`;

    onInsert(snippet);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-md p-6 bg-background border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
            <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <ImageIcon className="size-4" />
            </div>
            <span>Insert LaTeX Figure</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* File path */}
          <div className="space-y-1.5">
            <Label htmlFor="fig-filename" className="text-xs font-medium">
              Image File Name or Path
            </Label>
            <Input
              id="fig-filename"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="figures/chart.png"
              className="h-8 text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Relative to the root LaTeX document (e.g. <code>figures/chart.png</code>).
            </p>
          </div>

          {/* Width Preset Buttons */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Width Specification</Label>
              <span className="text-xs font-mono font-medium text-muted-foreground">
                {width}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {WIDTH_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setWidth(preset.value)}
                  className={cn(
                    'px-2.5 py-1 rounded text-xs font-mono font-medium border transition-colors cursor-pointer',
                    width === preset.value
                      ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                      : 'bg-background hover:bg-muted text-foreground border-border',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Caption and Label */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="fig-caption" className="text-xs font-medium">
                Caption
              </Label>
              <Input
                id="fig-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Description of figure..."
                className="h-8 text-xs font-normal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fig-label" className="text-xs font-medium">
                Label (reference)
              </Label>
              <Input
                id="fig-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="fig:my_figure"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Placement */}
          <div className="space-y-1.5 pt-1 border-t border-border">
            <div className="flex items-center justify-between">
              <Label htmlFor="fig-placement" className="text-xs font-medium">
                Float Placement Specifier
              </Label>
              <Input
                id="fig-placement"
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                className="h-7 w-24 text-xs font-mono text-center"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Default <code>htbp</code> (Here, Top, Bottom, Page).
            </p>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleInsert}
            className="h-8 text-xs font-medium gap-1.5"
          >
            <Check className="size-3.5" />
            <span>Insert Figure</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
