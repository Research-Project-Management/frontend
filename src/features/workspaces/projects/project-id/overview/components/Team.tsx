'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui';
import type { Member } from '../types/overview.types';

interface TeamProps {
  members: Member[];
}

function formatRole(role: string): string {
  if (!role) return 'Member';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export function Team({ members }: TeamProps) {
  if (!members || members.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Team Members</h2>
        <span className="text-xs text-muted-foreground">{members.length} members</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <div
            key={member.user._id}
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors"
          >
            <Avatar className="size-8 border border-border">
              {member.user.avatar && <AvatarImage src={member.user.avatar} alt={member.user.name} />}
              <AvatarFallback className="text-xs">
                {member.user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">
                {member.user.name}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {formatRole(member.role)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
