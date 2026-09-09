'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FolderUp } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface StorageDropzoneOverlayProps {
  children: React.ReactNode;
  onFilesDrop: (files: File[]) => void;
  folderName?: string;
  disabled?: boolean;
  className?: string;
}

export default function StorageDropzoneOverlay({
  children,
  onFilesDrop,
  folderName,
  disabled = false,
  className,
}: StorageDropzoneOverlayProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isFileDrag = (e: React.DragEvent | DragEvent) => {
    if (!e.dataTransfer?.types) return false;
    return Array.from(e.dataTransfer.types).includes('Files');
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  }, [disabled]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  }, [disabled]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      onFilesDrop(filesArray);
    }
  }, [disabled, onFilesDrop]);

  useEffect(() => {
    return () => {
      dragCounter.current = 0;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn("relative flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden", className)}
    >
      {children}

      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-2 z-50 rounded-md border-2 border-dashed border-primary bg-background/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center shadow-sm pointer-events-none"
          >
            <motion.div
              initial={{ y: 8, scale: 0.9 }}
              animate={{ y: 0, scale: 1 }}
              transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5, ease: "easeInOut" }}
              className="size-16 rounded-md bg-muted border border-border flex items-center justify-center text-primary mb-4"
            >
              <UploadCloud className="size-8 shrink-0" />
            </motion.div>
            
            <h3 className="text-base font-semibold tracking-tight text-foreground mb-1">
              Drop files here to upload
            </h3>
            
            <p className="text-sm text-muted-foreground max-w-sm flex items-center gap-1.5 justify-center mt-1">
              <FolderUp className="size-4 text-primary shrink-0" />
              <span>
                Uploading to: <strong className="text-foreground font-medium">{folderName || "Root directory"}</strong>
              </span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
