'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ChevronDown, Users } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui';
import TopBar from '../components/TopBar';
import { useMember } from '../hooks/use-member';
import { MemberFilter } from '../components/member/Filter';
import { MemberItem } from '../components/member/Item';
import { InviteDialog } from '../components/member/Dialog';
import { ImportModal } from '../components/member/ImportModal';
import { PendingInvites } from '../components/member/Pending';
import DeleteModal from '../components/DeleteModal';
import { cn } from '@/shared/lib/utils';

export default function WorkspaceMemberPage() {
  const { workspaceId } = useParams() as { workspaceId: string };

  const {
    workspace,
    currentUser,
    isLoading,
    canManage,
    activeTab,
    setActiveTab,
    members,
    filteredMembers,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    authFilter,
    setAuthFilter,
    sortField,
    sortDirection,
    toggleSort,
    inviteModalOpen,
    setInviteModalOpen,
    importModalOpen,
    setImportModalOpen,
    memberToRemove,
    setMemberToRemove,
    handleUpdateRole,
    handleRemoveMember,
    handleInviteMembers,
    handleImportCsv,
    isInviting,
    isRemoving,
  } = useMember(workspaceId);

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <TopBar title="Members" Icon={Users} />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="h-8 w-44 bg-muted/60 rounded-lg animate-pulse" />
            <div className="h-10 w-full bg-muted/40 rounded-lg animate-pulse" />
            <div className="h-64 w-full bg-muted/30 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* ── Topbar (Shared with General Settings) ── */}
      <TopBar title="Members" Icon={Users} />

      {/* ── Scrollable Body Content (Symmetrical Margins) ── */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
          {/* ── Page Title & Subtitle ── */}
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Members
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Manage access to this workspace.
            </p>
          </div>

          {/* ── Tabs & Toolbar Row (Matching Image) ── */}
          <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border/40 pb-0.5">
            {/* Left Sub-Tabs: People & Pending invitations with bottom line indicator */}
            <div className="flex items-center gap-2 text-xs">
              <div className="relative pb-2 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('people')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer outline-none',
                    activeTab === 'people'
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  People
                </button>
                {activeTab === 'people' && (
                  <div className="absolute -bottom-[2px] inset-x-1 h-[2px] bg-foreground rounded-full" />
                )}
              </div>

              <div className="relative pb-2 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('pending')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer outline-none',
                    activeTab === 'pending'
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  Pending invitations
                </button>
                {activeTab === 'pending' && (
                  <div className="absolute -bottom-[2px] inset-x-1 h-[2px] bg-foreground rounded-full" />
                )}
              </div>
            </div>

            {/* Right Toolbar: Search, Filters, Import, Add member */}
            <div className="pb-2">
              <MemberFilter
                search={search}
                roleFilter={roleFilter}
                authFilter={authFilter}
                canManage={canManage}
                onSearchChange={setSearch}
                onRoleFilterChange={setRoleFilter}
                onAuthFilterChange={setAuthFilter}
                onOpenImport={() => setImportModalOpen(true)}
                onAddMember={() => setInviteModalOpen(true)}
              />
            </div>
          </div>

      {/* ── Tab Content: People (Table List) ── */}
      {activeTab === 'people' && (
        <div className="rounded-lg border border-border/80 overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-muted/20 text-muted-foreground select-none">
                  {/* 1. Full name */}
                  <th className="py-2.5 px-4 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('name')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                    >
                      <span>Full name</span>
                      <ChevronDown
                        className={cn(
                          'size-3 transition-transform',
                          sortField === 'name' && sortDirection === 'asc' && 'rotate-180'
                        )}
                      />
                    </button>
                  </th>

                  {/* 2. Display name */}
                  <th className="py-2.5 px-4 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('displayName')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                    >
                      <span>Display name</span>
                      <ChevronDown
                        className={cn(
                          'size-3 transition-transform',
                          sortField === 'displayName' && sortDirection === 'asc' && 'rotate-180'
                        )}
                      />
                    </button>
                  </th>

                  {/* 3. Email */}
                  <th className="py-2.5 px-4 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('email')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                    >
                      <span>Email</span>
                      <ChevronDown
                        className={cn(
                          'size-3 transition-transform',
                          sortField === 'email' && sortDirection === 'asc' && 'rotate-180'
                        )}
                      />
                    </button>
                  </th>

                  {/* 4. Role */}
                  <th className="py-2.5 px-4 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('role')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                    >
                      <span>Role</span>
                      <ChevronDown
                        className={cn(
                          'size-3 transition-transform',
                          sortField === 'role' && sortDirection === 'asc' && 'rotate-180'
                        )}
                      />
                    </button>
                  </th>

                  {/* 5. Authentication */}
                  <th className="py-2.5 px-4 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('auth')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                    >
                      <span>Authentication</span>
                      <ChevronDown
                        className={cn(
                          'size-3 transition-transform',
                          sortField === 'auth' && sortDirection === 'asc' && 'rotate-180'
                        )}
                      />
                    </button>
                  </th>

                  {/* 6. Joining date */}
                  <th className="py-2.5 px-4 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort('date')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                    >
                      <span>Joining date</span>
                      <ChevronDown
                        className={cn(
                          'size-3 transition-transform',
                          sortField === 'date' && sortDirection === 'asc' && 'rotate-180'
                        )}
                      />
                    </button>
                  </th>

                  {/* Actions */}
                  <th className="py-2.5 px-2 w-10 pr-4"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/60">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-xs text-muted-foreground"
                    >
                      No members found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => (
                    <MemberItem
                      key={m.id || m.userId}
                      member={m}
                      currentUserId={currentUser?.id || (currentUser as any)?._id}
                      canManage={canManage}
                      onRoleChange={handleUpdateRole}
                      onRemove={(member) => setMemberToRemove(member)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab Content: Pending Invitations ── */}
      {activeTab === 'pending' && (
        <PendingInvites
          invites={[]}
          canManage={canManage}
          onCancelInvite={() => {}}
        />
      )}

      {/* ── Invite Members Dialog Modal ── */}
      <InviteDialog
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onInvite={handleInviteMembers}
        isInviting={isInviting}
      />

      {/* ── Import CSV Dialog Modal ── */}
      <ImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImport={handleImportCsv}
      />

      {/* ── Remove Member Confirmation Modal ── */}
      <DeleteModal
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        onConfirm={() => {
          if (memberToRemove) {
            handleRemoveMember(memberToRemove.userId);
          }
        }}
        title="Remove member from workspace"
        description={`Are you sure you want to remove ${memberToRemove?.user.name || 'this member'} from the workspace? They will lose access to all projects and resources.`}
        confirmText="Remove member"
        cancelText="Cancel"
        loading={isRemoving}
      />
        </div>
      </div>
    </div>
  );
}
