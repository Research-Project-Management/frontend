'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  CURATED_COVER_IMAGES,
  UNSPLASH_COVER_PHOTOS,
} from '@/shared/constants/cover-images.constants';

export interface CoverModalProps {
  currentCover?: string | null;
  onSelectCover: (coverUrl: string) => void;
  onUploadCustomCover: (file: File) => Promise<void>;
  isUploading?: boolean;
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function CoverModal({
  currentCover,
  onSelectCover,
  onUploadCustomCover,
  isUploading,
  children,
  title = 'Change Cover Image',
  description = 'Choose a cover image from Unsplash, curated textures, or upload a custom image.',
}: CoverModalProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'unsplash' | 'images' | 'upload'>('unsplash');
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handlePick = (url: string) => {
    onSelectCover(url);
    setOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadAndSave = async () => {
    if (selectedFile) {
      await onUploadCustomCover(selectedFile);
      setOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const filteredUnsplashPhotos = search.trim()
    ? UNSPLASH_COVER_PHOTOS.filter((_, i) => i < 8)
    : UNSPLASH_COVER_PHOTOS;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="max-w-xl p-5 rounded-md border border-border/80 bg-background space-y-4 shadow-raised-200">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* ── Top Tabs Segment Control ── */}
        <div className="grid grid-cols-3 p-1 rounded-md bg-muted border border-border">
          <button
            type="button"
            onClick={() => setTab('unsplash')}
            className={cn(
              'relative h-8 text-12 font-medium rounded-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden',
              tab === 'unsplash'
                ? 'bg-background text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
            )}
          >
            Unsplash
          </button>

          <button
            type="button"
            onClick={() => setTab('images')}
            className={cn(
              'relative h-8 text-12 font-medium rounded-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden',
              tab === 'images'
                ? 'bg-background text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
            )}
          >
            Images
          </button>

          <button
            type="button"
            onClick={() => setTab('upload')}
            className={cn(
              'relative h-8 text-12 font-medium rounded-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden',
              tab === 'upload'
                ? 'bg-background text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
            )}
          >
            Upload
          </button>
        </div>

        {/* ── Tab 1: Unsplash ── */}
        {tab === 'unsplash' && (
          <div className="space-y-3.5">
            {/* Search Bar with Search Button */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search for images"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-12 rounded-md border-border bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button
                type="button"
                className="relative h-8 px-4 text-12 font-medium bg-primary hover:bg-primary-hover text-primary-foreground rounded-md cursor-pointer shrink-0 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
              >
                Search
              </Button>
            </div>

            {/* 4-Col Grid of Photos */}
            <div className="max-h-72 overflow-y-auto grid grid-cols-4 gap-2.5 p-0.5">
              {filteredUnsplashPhotos.map((url, i) => (
                <button
                  key={`unsplash-${i}`}
                  type="button"
                  onClick={() => handlePick(url)}
                  className="group relative aspect-video rounded-lg overflow-hidden border border-border hover:border-border transition-all cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
                >
                  <img
                    src={url}
                    alt={`Cover ${i + 1}`}
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  {currentCover === url && (
                    <div className="absolute inset-0 bg-primary/20 ring-1 ring-primary ring-inset rounded-lg" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 2: Images ── */}
        {tab === 'images' && (
          <div className="max-h-80 overflow-y-auto grid grid-cols-4 gap-2.5 p-0.5">
            {CURATED_COVER_IMAGES.map((url, i) => (
              <button
                key={`curated-${i}`}
                type="button"
                onClick={() => handlePick(url)}
                className="group relative aspect-video rounded-lg overflow-hidden border border-border hover:border-border transition-all cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
              >
                <img
                  src={url}
                  alt={`Abstract cover ${i + 1}`}
                  className="size-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                {currentCover === url && (
                  <div className="absolute inset-0 bg-primary/20 ring-1 ring-primary ring-inset rounded-lg" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab 3: Upload ── */}
        {tab === 'upload' && (
          <div className="space-y-4">
            <label
              htmlFor="cover-file-dropzone"
              className="relative flex flex-col items-center justify-center p-8 border-2 border-dashed border-border hover:border-border/80 rounded-lg bg-muted hover:bg-muted transition-colors cursor-pointer min-h-[160px]"
            >
              <div className="absolute top-2 right-2 text-12 text-muted-foreground font-medium border border-border px-1.5 py-0.5 rounded bg-background">
                Edit
              </div>

              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-28 rounded-lg object-cover"
                />
              ) : (
                <div className="text-center space-y-1">
                  <p className="text-12 font-medium text-foreground">
                    Drag & drop image here
                  </p>
                </div>
              )}

              <input
                id="cover-file-dropzone"
                type="file"
                accept=".jpeg,.jpg,.png,.webp"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </label>

            <p className="text-12 text-muted-foreground">
              File formats supported: .jpeg, .jpg, .png, .webp
            </p>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setOpen(false);
                }}
                className="relative h-8 px-3 text-12 font-medium rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleUploadAndSave}
                disabled={!selectedFile || isUploading}
                className="relative h-8 px-4 text-12 font-medium bg-primary hover:bg-primary-hover text-primary-foreground rounded-md cursor-pointer disabled:opacity-50 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
              >
                {isUploading && (
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none mr-1.5 shrink-0" />
                )}
                Upload & Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CoverModal;
