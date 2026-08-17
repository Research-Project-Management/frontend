'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Lock,
  Globe,
  ChevronDown,
  ListFilter,
  Check,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { Project } from '../../types/project.types';
import {
  countActiveCriteria,
  type ProjectFilterCriteria,
} from '../../utils/projects-page.util';

export type ProjectFilterPopoverProps = {
  projects: Project[];
  filter: ProjectFilterCriteria;
  onFilterChange: (filter: ProjectFilterCriteria) => void;
  currentUserId?: string;
  currentUserName?: string;
};

function FilterCheckbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        'size-3.5 rounded-[4px] border flex items-center justify-center transition-colors shrink-0',
        checked
          ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-600 dark:border-blue-600'
          : 'border-muted-foreground/40 bg-background/50 hover:border-muted-foreground/70'
      )}
    >
      {checked && <Check className="size-2.5 stroke-[3] text-white" />}
    </div>
  );
}

export function ProjectFilterPopover({
  projects,
  filter,
  onFilterChange,
  currentUserId,
  currentUserName,
}: ProjectFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Collapsible section open states
  const [accessOpen, setAccessOpen] = useState(true);
  const [leadOpen, setLeadOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true);
  const [dateOpen, setDateOpen] = useState(true);

  // Extract unique leads
  const uniqueLeads = useMemo(() => {
    const leadMap = new Map<string, { id: string; name: string; avatar?: string }>();

    for (const p of projects) {
      const leadMember = p.members?.find(
        (m: any) =>
          m.role === 'manager' ||
          m.role === 'lead' ||
          m.role === 'owner' ||
          m.role === 'admin'
      );
      const user =
        leadMember?.user ||
        (p.createdBy?._id || (p.createdBy as any)?.id ? p.createdBy : null);

      if (user) {
        const id = String(user._id || (user as any).id || '');
        if (id && !leadMap.has(id)) {
          leadMap.set(id, {
            id,
            name: user.name || 'Unknown',
            avatar: user.avatar,
          });
        }
      }
    }

    // Always include current user if known
    if (currentUserId && !leadMap.has(currentUserId)) {
      leadMap.set(currentUserId, {
        id: currentUserId,
        name: currentUserName || 'You',
      });
    }

    return Array.from(leadMap.values());
  }, [projects, currentUserId, currentUserName]);

  // Extract unique members
  const uniqueMembers = useMemo(() => {
    const memberMap = new Map<string, { id: string; name: string; avatar?: string }>();

    for (const p of projects) {
      if (Array.isArray(p.members)) {
        for (const m of p.members) {
          const user = (m as any).user;
          if (user) {
            const id = String(user._id || user.id || '');
            if (id && !memberMap.has(id)) {
              memberMap.set(id, {
                id,
                name: user.name || 'Member',
                avatar: user.avatar,
              });
            }
          }
        }
      }
      if (p.createdBy?._id || (p.createdBy as any)?.id) {
        const id = String(p.createdBy?._id || (p.createdBy as any)?.id);
        if (!memberMap.has(id)) {
          memberMap.set(id, {
            id,
            name: p.createdBy?.name || 'Creator',
            avatar: p.createdBy?.avatar,
          });
        }
      }
    }

    if (currentUserId && !memberMap.has(currentUserId)) {
      memberMap.set(currentUserId, {
        id: currentUserId,
        name: currentUserName || 'You',
      });
    }

    return Array.from(memberMap.values());
  }, [projects, currentUserId, currentUserName]);

  const activeCount = countActiveCriteria(filter);

  const toggleAccess = (type: 'private' | 'public') => {
    const current = filter.access || [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onFilterChange({ ...filter, access: next });
  };

  const toggleLead = (leadId: string) => {
    const current = filter.leads || [];
    const next = current.includes(leadId)
      ? current.filter((id) => id !== leadId)
      : [...current, leadId];
    onFilterChange({ ...filter, leads: next });
  };

  const toggleMember = (memberId: string) => {
    const current = filter.members || [];
    const next = current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId];
    onFilterChange({ ...filter, members: next });
  };

  const setCreatedDate = (
    val: 'all' | 'today' | 'yesterday' | 'last-7-days' | 'last-30-days' | 'custom'
  ) => {
    onFilterChange({ ...filter, createdDate: val });
  };

  // Filter leads/members by popover search input
  const q = search.trim().toLowerCase();
  const filteredLeads = uniqueLeads.filter((l) => !q || l.name.toLowerCase().includes(q));
  const filteredMembers = uniqueMembers.filter((m) => !q || m.name.toLowerCase().includes(q));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  'size-8 rounded-lg bg-transparent border-border/60 cursor-pointer outline-none',
                  activeCount > 0 && 'bg-accent/80 border-border text-foreground'
                )}
                aria-label="Filter"
              >
                <ListFilter className="size-4 text-foreground" strokeWidth={2.5} />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            Filter
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-72 p-3 bg-popover border border-border shadow-xl rounded-xl z-50 select-none text-foreground"
      >
        {/* 1. Popover Search */}
        <div className="relative flex items-center mb-2.5">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="h-8 w-full pl-8 pr-2.5 text-xs bg-muted/40 hover:bg-muted/60 focus:bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground/60 text-foreground"
          />
        </div>

        {/* 2. My projects row */}
        <div className="mb-3">
          <label
            onClick={() => onFilterChange({ ...filter, myProjects: !filter.myProjects })}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer text-xs font-medium",
              filter.myProjects
                ? "bg-accent border-border/80 text-foreground"
                : "bg-muted/30 hover:bg-muted/60 border-transparent text-foreground"
            )}
          >
            <FilterCheckbox checked={Boolean(filter.myProjects)} />
            <span>My projects</span>
          </label>
        </div>

        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {/* 3. Access Section */}
          <div className="border-t border-border/40 pt-2.5">
            <button
              type="button"
              onClick={() => setAccessOpen(!accessOpen)}
              className="flex items-center justify-between w-full text-left text-xs font-semibold text-foreground/90 hover:text-foreground py-1 cursor-pointer outline-none"
            >
              <span>Access</span>
              <ChevronDown
                className={cn(
                  'size-3.5 text-muted-foreground transition-transform duration-200',
                  accessOpen ? '' : '-rotate-90'
                )}
              />
            </button>

            {accessOpen && (
              <div className="space-y-1 mt-1.5 pl-1">
                {/* Private */}
                <label
                  onClick={() => toggleAccess('private')}
                  className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-accent/50 cursor-pointer text-xs transition-colors"
                >
                  <FilterCheckbox checked={(filter.access || []).includes('private')} />
                  <Lock className="size-3.5 text-muted-foreground shrink-0" />
                  <span>Private</span>
                </label>

                {/* Public */}
                <label
                  onClick={() => toggleAccess('public')}
                  className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-accent/50 cursor-pointer text-xs transition-colors"
                >
                  <FilterCheckbox checked={(filter.access || []).includes('public')} />
                  <Globe className="size-3.5 text-muted-foreground shrink-0" />
                  <span>Public</span>
                </label>
              </div>
            )}
          </div>

          {/* 4. Lead Section */}
          {filteredLeads.length > 0 && (
            <div className="border-t border-border/40 pt-2.5">
              <button
                type="button"
                onClick={() => setLeadOpen(!leadOpen)}
                className="flex items-center justify-between w-full text-left text-xs font-semibold text-foreground/90 hover:text-foreground py-1 cursor-pointer outline-none"
              >
                <span>Lead</span>
                <ChevronDown
                  className={cn(
                    'size-3.5 text-muted-foreground transition-transform duration-200',
                    leadOpen ? '' : '-rotate-90'
                  )}
                />
              </button>

              {leadOpen && (
                <div className="space-y-1 mt-1.5 pl-1 max-h-36 overflow-y-auto">
                  {filteredLeads.map((lead) => {
                    const isChecked = (filter.leads || []).includes(lead.id);
                    const isYou = currentUserId && lead.id === currentUserId;
                    const displayName = isYou ? 'You' : lead.name;

                    return (
                      <label
                        key={lead.id}
                        onClick={() => toggleLead(lead.id)}
                        className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-accent/50 cursor-pointer text-xs transition-colors"
                      >
                        <FilterCheckbox checked={isChecked} />
                        <Avatar className="size-4 shrink-0">
                          {lead.avatar && <AvatarImage src={lead.avatar} alt={displayName} />}
                          <AvatarFallback className="text-[8px] bg-muted font-medium">
                            {displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate flex-1">{displayName}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 5. Members Section */}
          {filteredMembers.length > 0 && (
            <div className="border-t border-border/40 pt-2.5">
              <button
                type="button"
                onClick={() => setMembersOpen(!membersOpen)}
                className="flex items-center justify-between w-full text-left text-xs font-semibold text-foreground/90 hover:text-foreground py-1 cursor-pointer outline-none"
              >
                <span>Members</span>
                <ChevronDown
                  className={cn(
                    'size-3.5 text-muted-foreground transition-transform duration-200',
                    membersOpen ? '' : '-rotate-90'
                  )}
                />
              </button>

              {membersOpen && (
                <div className="space-y-1 mt-1.5 pl-1 max-h-36 overflow-y-auto">
                  {filteredMembers.map((member) => {
                    const isChecked = (filter.members || []).includes(member.id);
                    const isYou = currentUserId && member.id === currentUserId;
                    const displayName = isYou ? 'You' : member.name;

                    return (
                      <label
                        key={member.id}
                        onClick={() => toggleMember(member.id)}
                        className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-accent/50 cursor-pointer text-xs transition-colors"
                      >
                        <FilterCheckbox checked={isChecked} />
                        <Avatar className="size-4 shrink-0">
                          {member.avatar && <AvatarImage src={member.avatar} alt={displayName} />}
                          <AvatarFallback className="text-[8px] bg-muted font-medium">
                            {displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate flex-1">{displayName}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 6. Created Date Section */}
          <div className="border-t border-border/40 pt-2.5">
            <button
              type="button"
              onClick={() => setDateOpen(!dateOpen)}
              className="flex items-center justify-between w-full text-left text-xs font-semibold text-foreground/90 hover:text-foreground py-1 cursor-pointer outline-none"
            >
              <span>Created date</span>
              <ChevronDown
                className={cn(
                  'size-3.5 text-muted-foreground transition-transform duration-200',
                  dateOpen ? '' : '-rotate-90'
                )}
              />
            </button>

            {dateOpen && (
              <div className="space-y-1 mt-1.5 pl-1">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'last-7-days', label: 'Last 7 days' },
                  { id: 'last-30-days', label: 'Last 30 days' },
                  { id: 'custom', label: 'Custom' },
                ].map((item) => {
                  const isSelected = filter.createdDate === item.id;
                  return (
                    <label
                      key={item.id}
                      onClick={() => setCreatedDate(isSelected ? 'all' : (item.id as any))}
                      className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-accent/50 cursor-pointer text-xs transition-colors"
                    >
                      <FilterCheckbox checked={isSelected} />
                      <span>{item.label}</span>
                    </label>
                  );
                })}

                {/* Custom Date Pickers */}
                {filter.createdDate === 'custom' && (
                  <div className="mt-2 pt-2 border-t border-border/30 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-10">From:</span>
                      <input
                        type="date"
                        value={filter.customDateRange?.from || ''}
                        onChange={(e) =>
                          onFilterChange({
                            ...filter,
                            customDateRange: {
                              ...filter.customDateRange,
                              from: e.target.value,
                            },
                          })
                        }
                        className="h-7 px-2 text-xs bg-muted/40 border border-border rounded flex-1 outline-none text-foreground"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-10">To:</span>
                      <input
                        type="date"
                        value={filter.customDateRange?.to || ''}
                        onChange={(e) =>
                          onFilterChange({
                            ...filter,
                            customDateRange: {
                              ...filter.customDateRange,
                              to: e.target.value,
                            },
                          })
                        }
                        className="h-7 px-2 text-xs bg-muted/40 border border-border rounded flex-1 outline-none text-foreground"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ProjectFilterPopover;
