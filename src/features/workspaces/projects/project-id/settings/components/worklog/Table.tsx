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
import type { WorklogEntry } from '../../types/worklog.types';

interface WorklogTableProps {
  logs: WorklogEntry[];
  onDelete: (id: string) => void;
}

export function WorklogTable({ logs, onDelete }: WorklogTableProps) {
  return (
    <div className="rounded-lg border border-border/80 overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-muted/20 text-muted-foreground">
              <th className="py-2.5 px-4 font-medium">User</th>
              <th className="py-2.5 px-4 font-medium">Task / Activity</th>
              <th className="py-2.5 px-4 font-medium">Hours</th>
              <th className="py-2.5 px-4 font-medium">Date</th>
              <th className="py-2.5 px-4 font-medium">Description</th>
              <th className="py-2.5 px-2 w-10 pr-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-muted/20 transition-colors group">
                {/* User */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="size-6 rounded-full border border-border/80 shrink-0">
                      {log.user.avatar && (
                        <AvatarImage src={log.user.avatar} className="object-cover" />
                      )}
                      <AvatarFallback className="text-[9px] bg-muted text-muted-foreground font-semibold">
                        {log.user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground truncate max-w-[140px]">
                      {log.user.name}
                    </span>
                  </div>
                </td>

                {/* Task */}
                <td className="py-3 px-4 font-medium text-foreground max-w-[180px] truncate">
                  {log.taskTitle}
                </td>

                {/* Hours */}
                <td className="py-3 px-4">
                  <Badge variant="secondary" className="text-[10px] font-medium h-4.5 px-1.5 rounded">
                    {log.hours} {log.hours === 1 ? 'hr' : 'hrs'}
                  </Badge>
                </td>

                {/* Date */}
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                  {log.date}
                </td>

                {/* Description */}
                <td className="py-3 px-4 text-muted-foreground max-w-[220px] truncate">
                  {log.description || '—'}
                </td>

                {/* Delete */}
                <td className="py-3 px-2 text-right pr-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(log.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer rounded-md"
                    title="Delete log"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
