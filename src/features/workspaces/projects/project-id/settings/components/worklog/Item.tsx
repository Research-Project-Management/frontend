'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
} from '@/shared/components/ui';

interface WorklogItemProps {
  log: {
    id: string;
    taskTitle: string;
    hours: number;
    date: string;
    description?: string;
    user: {
      name: string;
      avatar?: string;
    };
  };
  onDelete: (id: string) => void;
}

export function WorklogItem({ log, onDelete }: WorklogItemProps) {
  return (
    <div className="p-4 rounded-lg border border-border/80 bg-card hover:bg-muted/20 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3 group">
      <div className="flex items-start gap-3 min-w-0">
        <Avatar className="size-8 rounded-full border border-border/80 shrink-0 mt-0.5">
          <AvatarImage src={log.user.avatar} alt={log.user.name} />
          <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
            {log.user.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground truncate">
              {log.taskTitle}
            </span>
            <Badge variant="secondary" className="text-[10px] font-medium h-4.5 px-1.5 rounded">
              {log.hours} {log.hours === 1 ? 'hr' : 'hrs'}
            </Badge>
          </div>

          {log.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {log.description}
            </p>
          )}

          <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground/80 pt-0.5">
            <span>{log.user.name}</span>
            <span>•</span>
            <span>{log.date}</span>
          </div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(log.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer rounded-md"
        title="Delete entry"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
