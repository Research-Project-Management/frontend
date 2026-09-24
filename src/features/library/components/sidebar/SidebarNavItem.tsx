'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from "@/shared/lib/utils";

export interface SidebarNavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  navId: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  onDropItems?: (itemIds: string[]) => void;
}

export function SidebarNavItem({
  href,
  icon: Icon,
  label,
  isActive,
  navId,
  badge,
  onClick,
  onDropItems,
}: SidebarNavItemProps) {
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!onDropItems) return;
    if (e.dataTransfer.types.includes('application/x-flux-items')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (!isDragOverTarget) setIsDragOverTarget(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!onDropItems) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTarget(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!onDropItems) return;
    if (e.dataTransfer.types.includes('application/x-flux-items')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOverTarget(false);
      try {
        const raw = e.dataTransfer.getData('application/x-flux-items');
        if (raw) {
          const parsed = JSON.parse(raw) as string[] | { ids?: string[] };
          const ids = Array.isArray(parsed) ? parsed : (parsed?.ids || []);
          if (ids.length > 0) {
            onDropItems(ids);
          }
        }
      } catch (err) {
        console.error('Failed to parse dropped items', err);
      }
    }
  };

  return (
    <Link
      href={href}
      onClick={onClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "group/item relative flex h-8 items-center gap-2.5 rounded-md pr-2.5 text-13 leading-5 transition-colors outline-none select-none pl-6",
        isActive
          ? "bg-muted text-foreground font-medium"
          : "text-foreground hover:bg-muted font-normal",
        isDragOverTarget && "bg-primary/15 text-primary font-medium ring-1 ring-primary/40 ring-inset"
      )}
    >
      {isActive && (
        <motion.div
          layoutId={`library-nav-active-${navId}`}
          className="absolute inset-0 rounded-md bg-muted"
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
      <Icon className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
      <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight">
        {label}
      </span>
      {badge}
    </Link>
  );
}
