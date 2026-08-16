'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton, Button, Input } from '@/shared/components/ui';
import DeleteModal from '@/features/workspaces/settings/components/DeleteModal';
import { toast } from 'sonner';
import { Lead } from '../components/member/Lead';
import { Assignee } from '../components/member/Assignee';
import { Subscribers } from '../components/member/Subscribers';
import { Item } from '../components/member/Item';
import { Filter } from '../components/member/Filter';
import { AddMemberDialog } from '../components/member/Dialog';
import { useMembers } from '../hooks/use-member';
import type { ProjectMemberItem } from '../types/member.types';

export default function MemberPage() {
  const { projectId } = useParams() as { projectId: string };
  const {
    project,
    members,
    filteredMembers,
    workspace,
    currentUser,
    isOwnerOrAdmin,
    isLoading,
    isError,
    // Project Settings
    leadId,
    setLead,
    defaultAssigneeId,
    setDefaultAssignee,
    subscriberIds,
    toggleSubscriber,
    // Member actions
    addMembers,
    updateRole,
    removeMember,
    isAdding,
    // Search & Filter
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    sortField,
    sortAsc,
    toggleSort,
  } = useMembers(projectId);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState<ProjectMemberItem | null>(null);

  const existingMemberIds = useMemo(() => {
    return new Set<string>(members.map((m: any) => m.userId));
  }, [members]);


  const confirmDelete = () => {
    if (!deletingMember) return;
    removeMember(deletingMember.userId);
    setDeletingMember(null);
  };

  const handleImport = () => {
    toast.info('Importing members from CSV is coming soon');
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Error loading project members.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Members
        </h1>
      </div>

      {/* ── Top Settings Section ── */}
      <div className="space-y-5">
        <Lead
          members={members}
          leadId={leadId}
          onSelect={setLead}
          disabled={!isOwnerOrAdmin}
        />

        <Assignee
          members={members}
          defaultAssigneeId={defaultAssigneeId}
          onSelect={setDefaultAssignee}
          disabled={!isOwnerOrAdmin}
        />

        <Subscribers
          members={members}
          subscriberIds={subscriberIds}
          onToggle={toggleSubscriber}
          disabled={!isOwnerOrAdmin}
        />
      </div>

      {/* ── Members Table Section ── */}
      <div className="space-y-4 pt-2">
        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Members</h2>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs border-border/80 bg-background focus:ring-0 focus:outline-none rounded-md"
              />
            </div>

            {/* Filters */}
            <Filter
              currentRole={roleFilter}
              onSelectRole={setRoleFilter}
            />

            {/* Import */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              className="h-8 px-3 text-xs font-medium border-border/80 bg-background hover:bg-muted/50 text-foreground cursor-pointer rounded-md shrink-0"
            >
              Import
            </Button>

            {/* Add member */}
            {isOwnerOrAdmin && (
              <Button
                size="sm"
                onClick={() => setAddDialogOpen(true)}
                className="h-8 px-3.5 text-xs font-medium bg-[#0070f3] hover:bg-[#0060df] text-white cursor-pointer rounded-md shadow-2xs shrink-0"
              >
                Add member
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border/80 overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-muted/20 text-muted-foreground">
                  <th
                    className="py-2.5 px-4 font-medium"
                    aria-sort={sortField === 'name' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('name')}
                      aria-label="Sort by full name"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer outline-none"
                    >
                      <span>Full name</span>
                      {sortField === 'name' ? (
                        sortAsc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                      ) : (
                        <ChevronDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>

                  <th
                    className="py-2.5 px-4 font-medium"
                    aria-sort={sortField === 'displayName' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('displayName')}
                      aria-label="Sort by display name"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer outline-none"
                    >
                      <span>Display name</span>
                      {sortField === 'displayName' ? (
                        sortAsc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                      ) : (
                        <ChevronDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>

                  <th
                    className="py-2.5 px-4 font-medium"
                    aria-sort={sortField === 'email' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('email')}
                      aria-label="Sort by email"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer outline-none"
                    >
                      <span>Email</span>
                      {sortField === 'email' ? (
                        sortAsc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                      ) : (
                        <ChevronDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>

                  <th
                    className="py-2.5 px-4 font-medium"
                    aria-sort={sortField === 'role' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('role')}
                      aria-label="Sort by role"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer outline-none"
                    >
                      <span>Role</span>
                      {sortField === 'role' ? (
                        sortAsc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                      ) : (
                        <ChevronDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>

                  <th
                    className="py-2.5 px-4 font-medium"
                    aria-sort={sortField === 'date' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('date')}
                      aria-label="Sort by joining date"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer outline-none"
                    >
                      <span>Joining date</span>
                      {sortField === 'date' ? (
                        sortAsc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
                      ) : (
                        <ChevronDown className="size-3 text-muted-foreground/60" />
                      )}
                    </button>
                  </th>

                  <th className="py-2.5 px-2 w-10 pr-4"></th>
                </tr>
              </thead>

              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-xs text-muted-foreground"
                    >
                      {search || roleFilter
                        ? 'No members found matching your search.'
                        : 'No members in this project.'}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member: any) => {
                    const isCurrentUser =

                      currentUser?.id === member.userId ||
                      (currentUser as any)?._id === member.userId;

                    return (
                      <Item
                        key={member.userId}
                        member={member}
                        canManage={isOwnerOrAdmin}
                        isCurrentUser={isCurrentUser}
                        onUpdateRole={(newRole) =>
                          updateRole(member.userId, newRole)
                        }
                        onRemove={() => setDeletingMember(member)}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Add Member Dialog ── */}
      <AddMemberDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        workspace={workspace}
        existingMemberIds={existingMemberIds}
        onAdd={addMembers}
        isLoading={isAdding}
      />

      {/* ── Remove Member Confirmation Modal ── */}
      <DeleteModal
        isOpen={Boolean(deletingMember)}
        onClose={() => setDeletingMember(null)}
        onConfirm={confirmDelete}
        title="Remove member"
        description={`Are you sure you want to remove ${deletingMember?.user.name || 'this member'} from the project? They will lose access to all project resources.`}
        confirmText="Remove member"
        cancelText="Cancel"
      />
    </div>
  );
}
