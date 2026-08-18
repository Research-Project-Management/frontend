'use client';

import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Button,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

interface CoverModalProps {
  currentCover?: string | null;
  onSelectCover: (coverUrl: string) => void;
  onUploadCustomCover: (file: File) => Promise<void>;
  isUploading?: boolean;
  children: React.ReactNode;
}

// 24 Curated High Quality Abstract & Texture Cover Photos for Tab 2
const CURATED_IMAGES = [
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511497584788-87676104235f?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=80',
];

// Curated Photos for Tab 1 (Unsplash Search / Gallery)
const UNSPLASH_PHOTOS = [
  'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
];

export function CoverModal({
  currentCover,
  onSelectCover,
  onUploadCustomCover,
  isUploading,
  children,
}: CoverModalProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'unsplash' | 'images' | 'upload'>('unsplash');
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="max-w-xl p-5 rounded-lg border border-border/80 bg-background shadow-2xl space-y-4">
        <DialogHeader className="sr-only">
          <DialogTitle>Change Project Cover</DialogTitle>
        </DialogHeader>

        {/* ── Top Tabs Segment Control (Image 3, 4, 5) ── */}
        <div className="grid grid-cols-3 p-1 rounded-lg bg-muted/60 border border-border/60">
          <button
            type="button"
            onClick={() => setTab('unsplash')}
            className={cn(
              'h-8 text-xs font-medium rounded-lg transition-all cursor-pointer',
              tab === 'unsplash'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Unsplash
          </button>

          <button
            type="button"
            onClick={() => setTab('images')}
            className={cn(
              'h-8 text-xs font-medium rounded-lg transition-all cursor-pointer',
              tab === 'images'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Images
          </button>

          <button
            type="button"
            onClick={() => setTab('upload')}
            className={cn(
              'h-8 text-xs font-medium rounded-lg transition-all cursor-pointer',
              tab === 'upload'
                ? 'bg-background text-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Upload
          </button>
        </div>

        {/* ── Tab 1: Unsplash (Image 3) ── */}
        {tab === 'unsplash' && (
          <div className="space-y-3.5">
            {/* Search Bar with Search Button */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search for images"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-xs rounded-lg border-border/80 bg-background focus:ring-0 focus:outline-none"
              />
              <Button
                type="button"
                className="h-9 px-4 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-md cursor-pointer shrink-0 shadow-2xs"
              >
                Search
              </Button>
            </div>

            {/* 4-Col Grid of Photos */}
            <div className="max-h-72 overflow-y-auto grid grid-cols-4 gap-2.5 p-0.5">
              {UNSPLASH_PHOTOS.map((url, i) => (
                <button
                  key={`unsplash-${i}`}
                  type="button"
                  onClick={() => handlePick(url)}
                  className="group relative aspect-video rounded-lg overflow-hidden border border-border/60 hover:border-primary/80 transition-all cursor-pointer focus:outline-none"
                >
                  <img
                    src={url}
                    alt={`Cover ${i + 1}`}
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  {currentCover === url && (
                    <div className="absolute inset-0 bg-primary/20 ring-2 ring-primary ring-inset rounded-lg" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 2: Images (Image 4) ── */}
        {tab === 'images' && (
          <div className="max-h-80 overflow-y-auto grid grid-cols-4 gap-2.5 p-0.5">
            {CURATED_IMAGES.map((url, i) => (
              <button
                key={`curated-${i}`}
                type="button"
                onClick={() => handlePick(url)}
                className="group relative aspect-video rounded-lg overflow-hidden border border-border/60 hover:border-primary/80 transition-all cursor-pointer focus:outline-none"
              >
                <img
                  src={url}
                  alt={`Abstract cover ${i + 1}`}
                  className="size-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                {currentCover === url && (
                  <div className="absolute inset-0 bg-primary/20 ring-2 ring-primary ring-inset rounded-lg" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab 3: Upload (Image 5) ── */}
        {tab === 'upload' && (
          <div className="space-y-4">
            <label
              htmlFor="cover-file-dropzone"
              className="relative flex flex-col items-center justify-center p-8 border-2 border-dashed border-border/80 hover:border-primary/60 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer min-h-[160px]"
            >
              <div className="absolute top-2 right-2 text-[10px] text-muted-foreground font-medium border border-border/60 px-1.5 py-0.5 rounded bg-background">
                Edit
              </div>

              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-28 rounded-lg object-cover shadow-xs"
                />
              ) : (
                <div className="text-center space-y-1">
                  <p className="text-xs font-medium text-foreground">
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

            <p className="text-[11px] text-muted-foreground">
              File formats supported- .jpeg, .jpg, .png, .webp
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
                className="h-8 text-xs font-medium rounded-lg cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleUploadAndSave}
                disabled={!selectedFile || isUploading}
                className="h-8 px-4 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-md cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isUploading && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                Upload & Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
