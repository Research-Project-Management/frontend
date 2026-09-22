'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Check,
  Copy,
  FolderOpen,
  FileImage,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Checkbox,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { useEditorStorage } from '@/features/editor/hooks/use-storage';
import { resolveFileUrl } from '@/features/editor/utils/editor.util';

export interface FigureWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPageId: string | null;
  onInsert: (latexCode: string) => void;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'pdf', 'svg', 'eps', 'webp', 'gif']);

const WIDTH_PRESETS = [
  { id: '0.5\\linewidth', label: '50% (0.5\\linewidth)' },
  { id: '0.8\\linewidth', label: '80% (0.8\\linewidth)' },
  { id: '1.0\\linewidth', label: '100% (1.0\\linewidth)' },
  { id: '\\textwidth', label: 'Full Text Width (\\textwidth)' },
  { id: '8cm', label: 'Fixed 8cm' },
];

export default function FigureWizardModal({
  open,
  onOpenChange,
  parentPageId,
  onInsert,
}: FigureWizardModalProps) {
  const { files, isLoading, uploadFile } = useEditorStorage(parentPageId, undefined);

  // Filter for image files
  const imageFiles = useMemo(() => {
    if (!files) return [];
    return files.filter((f) => {
      if (f.isFolder) return false;
      const ext = f.filename.split('.').pop()?.toLowerCase() ?? '';
      return IMAGE_EXTENSIONS.has(ext) || (f.mimeType && f.mimeType.startsWith('image/'));
    });
  }, [files]);

  const [selectedFilename, setSelectedFilename] = useState<string>('');
  const [caption, setCaption] = useState<string>('Figure caption');
  const [label, setLabel] = useState<string>('fig:my_figure');
  const [width, setWidth] = useState<string>('0.8\\linewidth');
  const [placement, setPlacement] = useState<string>('htbp');
  const [centering, setCentering] = useState<boolean>(true);

  // Auto-select first image if none selected
  useEffect(() => {
    if (imageFiles.length > 0 && !selectedFilename) {
      const first = imageFiles[0];
      setSelectedFilename(first.filename);
      const stem = first.filename.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      setLabel(`fig:${stem}`);
    }
  }, [imageFiles, selectedFilename]);

  // Upload handler
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectImage = (filename: string) => {
    setSelectedFilename(filename);
    const stem = filename.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    setLabel(`fig:${stem}`);
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFiles = e.target.files;
    if (!pickedFiles || pickedFiles.length === 0) return;

    try {
      const fileList = Array.from(pickedFiles);
      if (fileList.length > 0 && parentPageId) {
        for (const file of fileList) {
          await uploadFile.mutateAsync({ file, pageId: parentPageId, parentId: null });
        }
        const uploadedName = fileList[0].name;
        handleSelectImage(uploadedName);
        toast.success(`Uploaded ${uploadedName}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload image');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Generate LaTeX figure snippet
  const generatedLatex = useMemo(() => {
    const imgName = selectedFilename || 'example-image.png';

    let code = `\\begin{figure}[${placement}]\n`;
    if (centering) {
      code += `  \\centering\n`;
    }
    code += `  \\includegraphics[width=${width}]{${imgName}}\n`;
    if (caption) {
      code += `  \\caption{${caption}}\n`;
    }
    if (label) {
      code += `  \\label{${label}}\n`;
    }
    code += `\\end{figure}\n`;
    return code;
  }, [selectedFilename, placement, centering, width, caption, label]);

  const handleInsert = () => {
    onInsert(generatedLatex);
    toast.success('Figure inserted into document');
    onOpenChange(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedLatex);
    toast.info('LaTeX code copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6 gap-4 text-xs bg-background border border-border shadow-raised-300 rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ImageIcon className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Insert LaTeX Figure
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select an image from your project files or upload a new figure.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.eps"
          className="hidden"
          onChange={handleFilePicked}
        />

        {/* Section 1: Image Selector Gallery */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Select Project Image ({imageFiles.length} available)
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadFile.isPending}
              className="gap-1.5 h-7 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-2xs"
            >
              {uploadFile.isPending ? (
                <Loader2 className="size-3 animate-spin text-primary" />
              ) : (
                <Upload className="size-3" />
              )}
              Upload Image
            </Button>
          </div>

          {isLoading ? (
            <div className="h-32 rounded-md border border-border bg-muted/20 flex items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : imageFiles.length === 0 ? (
            <div className="h-32 rounded-md border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-2 text-center p-4">
              <FileImage className="size-8 text-muted-foreground/40" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">No images in project yet</p>
                <p className="text-11 text-muted-foreground">
                  Click the Upload Image button above to add a PNG, JPG, or PDF graphic.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-44 overflow-y-auto p-1.5 border border-border rounded-md bg-muted/10">
              {imageFiles.map((img) => {
                const isSelected = selectedFilename === img.filename;
                const url = resolveFileUrl(img.url);
                return (
                  <div
                    key={img.id}
                    onClick={() => handleSelectImage(img.filename)}
                    className={cn(
                      'group relative rounded-md border p-1.5 flex flex-col items-center gap-1.5 cursor-pointer transition-all',
                      isSelected
                        ? 'bg-primary/10 border-primary shadow-2xs'
                        : 'bg-background border-border hover:border-border hover:bg-muted/40'
                    )}
                  >
                    <div className="w-full h-16 rounded-sm bg-muted flex items-center justify-center overflow-hidden">
                      {url ? (
                        <img
                          src={url}
                          alt={img.filename}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <FileImage className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <span className="w-full truncate text-11 text-center font-mono font-medium text-foreground">
                      {img.filename}
                    </span>

                    {isSelected && (
                      <div className="absolute top-1 right-1 size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-2xs">
                        <Check className="size-2.5" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Figure Settings */}
        <div className="space-y-3 pt-2 border-t border-border">
          {/* Width Presets */}
          <div>
            <label className="text-11 font-medium text-muted-foreground mb-1 block">
              Figure Width
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {WIDTH_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setWidth(p.id)}
                  className={cn(
                    'h-7 px-2 text-11 font-medium rounded-sm border truncate text-center transition-colors cursor-pointer',
                    width === p.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-foreground hover:bg-muted shadow-2xs'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Caption & Label */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-11 font-medium text-muted-foreground mb-1 block">
                Caption
              </label>
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Figure caption description"
                className="h-8 text-xs rounded-md border-border bg-background"
              />
            </div>
            <div>
              <label className="text-11 font-medium text-muted-foreground mb-1 block">
                Label (for \ref)
              </label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="fig:my_figure"
                className="h-8 text-xs font-mono rounded-md border-border bg-background"
              />
            </div>
          </div>

          {/* Placement & Centering */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-11 font-medium text-muted-foreground">
                Placement:
              </label>
              <div className="flex items-center gap-1">
                {['htbp', '!ht', 't', 'b', 'h'].map((spec) => (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => setPlacement(spec)}
                    className={cn(
                      'px-2 py-0.5 text-11 font-mono rounded-sm border transition-colors cursor-pointer',
                      placement === spec
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-foreground hover:bg-muted shadow-2xs'
                    )}
                  >
                    [{spec}]
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="figure-centering"
                checked={centering}
                onCheckedChange={(c) => setCentering(Boolean(c))}
              />
              <label
                htmlFor="figure-centering"
                className="text-xs font-medium text-foreground cursor-pointer"
              >
                Center figure (\centering)
              </label>
            </div>
          </div>
        </div>

        {/* Live Code Preview */}
        <div className="border border-border rounded-md bg-muted/10 p-2.5 font-mono text-11 max-h-24 overflow-y-auto select-all">
          <pre className="text-foreground leading-relaxed whitespace-pre-wrap">
            {generatedLatex}
          </pre>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            className="gap-1.5 h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-2xs"
          >
            <Copy className="size-3.5" />
            Copy Code
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-2xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleInsert}
              className="gap-1.5 h-8 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-2xs cursor-pointer"
            >
              <Check className="size-3.5" />
              Insert Figure
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
