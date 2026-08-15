'use client';

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useProjectDetails } from '@/features/workspaces/projects/shell/services/project.services';
import { useAddProjectMember } from '@/features/workspaces/projects/shell/services/project.services';
import { useUpdateProjectMemberRole } from '@/features/workspaces/projects/shell/services/project.services';
import { useRemoveProjectMember } from '@/features/workspaces/projects/shell/services/project.services';
import { type Project } from '@/features/workspaces/projects/shell/types/project.types';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useWorkspaceProjects } from '@/features/workspaces/projects/shell/services/project.services';
import { useAuth } from '@/features/auth';
import {
  MoreVertical,
  UserPlus,
  Search,
  Loader2,
} from "lucide-react";
import { Skeleton } from '@/shared/components/ui';
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/shared/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui";

function getRoleName(roleOrMember?: string | { role?: string }): string {
  const role = typeof roleOrMember === 'string' ? roleOrMember : roleOrMember?.role;
  if (!role) return 'Member';
  switch (role.toLowerCase()) {
    case 'owner': return 'Owner';
    case 'admin': return 'Admin';
    case 'member': return 'Member';
    case 'viewer': return 'Viewer';
    default: return role;
  }
}

export default function ProjectTeam() {
  const { projectId, workspaceId: workspaceUrl } = useParams() as { projectId: string, workspaceId: string };
  const [searchTerm, setSearchTerm] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  // Fetch data
  const { data: projectData, isLoading: isProjectLoading } = useProjectDetails(
    projectId!,
  );
  const pData = projectData as any;
  const { workspace, yourRole: workspaceRole, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const { projects, isLoading: isProjectsLoading } = useWorkspaceProjects(workspaceUrl!);
  const roles = [
    { _id: 'owner', name: 'Owner' },
    { _id: 'admin', name: 'Admin' },
    { _id: 'member', name: 'Member' },
    { _id: 'viewer', name: 'Viewer' }
  ];

  const project = useMemo(() => {
    const p = (pData?.project || pData) as Project;
    if (p && p._id) return p;

    if (projects) {
      return (projects.find((p: any) => p._id === projectId || p.url === projectId || p.name === projectId) as unknown as Project) || null;
    }
    return null;
  }, [pData, projects, projectId]);

  const projectUserRole = pData?.yourRole || pData?.role;
  const { user: currentUser } = useAuth();

  // Mutations
  const updateRoleMutation = useUpdateProjectMemberRole();
  const removeMemberMutation = useRemoveProjectMember();

  const handleUpdateRole = (userId: string, newRole: string) => {
    updateRoleMutation.mutate(
      { projectId: project?._id || projectId!, userId, newRole },
      {
        onSuccess: () => {
          toast.success("Member role updated successfully");
        },
        onError: (error: any) => {
          toast.error(error.message || "Failed to update member role");
        },
      },
    );
  };

  const handleRemoveMember = (userId: string) => {
    if (
      confirm("Are you sure you want to remove this member from the project?")
    ) {
      removeMemberMutation.mutate(
        { projectId: project?._id || projectId!, userId },
        {
          onSuccess: () => {
            toast.success("Member removed successfully");
          },
          onError: (error: any) => {
            toast.error(error.message || "Failed to remove member");
          },
        },
      );
    }
  };

  if ((isProjectLoading && !project) || isWorkspaceLoading || (isProjectsLoading && !projects)) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 p-6 space-y-6 flex flex-col items-center justify-center">
          <Skeleton className="h-32 w-full max-w-lg rounded-xl" />
        </div>
      </div>
    );
  }
  if (!project) return <div className="p-12 text-center text-muted-foreground text-sm italic">Project not found</div>;

  const filteredMembers = (project.members || []).filter(
    (m: any) =>
      m.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const canManageTeam =
    projectUserRole === "admin" || 
    projectUserRole === "owner" ||
    workspaceRole === "owner" || 
    workspaceRole === "admin" ||
    project.createdBy?._id === currentUser?._id;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-1 p-4 space-y-5 flex flex-col overflow-hidden max-w-3xl mx-auto w-full">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-[17px] font-semibold text-foreground">Project Team</h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              Manage team members and their roles within this project.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
               <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  {(project.members || []).length} {(project.members || []).length === 1 ? "member" : "members"}
               </span>
            </div>
          </div>
        {canManageTeam && (
          <Button onClick={() => setAddMemberOpen(true)} size="sm" className="cursor-pointer gap-2 rounded-lg">
            <UserPlus className="h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search members..."
            className="pl-9 h-9 rounded-lg border-border text-[13px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto border border-border rounded-lg">
        <table className="w-full text-[13px]">
          <thead className="bg-muted sticky top-0 z-10 border-b border-border text-muted-foreground">
            <tr>
              <th className="text-left p-2.5 font-medium pl-4">User</th>
              <th className="text-left p-2.5 font-medium">Role</th>
              <th className="text-left p-2.5 font-medium">Joined</th>
              <th className="p-2.5 w-[50px] pr-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredMembers.map((member: any) => {
              const isCurrentUser = currentUser?._id === member.user?._id;
              const memberName = isCurrentUser ? (currentUser?.name || member.user?.name) : member.user?.name || "Unknown User";
              const memberEmail = isCurrentUser ? (currentUser?.email || member.user?.email) : member.user?.email || "No email";
              const memberAvatar = isCurrentUser ? (currentUser?.avatar || member.user?.avatar) : member.user?.avatar;
              const initials = memberName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

              return (
                <tr
                  key={member.user?._id || Math.random()}
                  className="group hover:bg-muted/40 transition-colors"
                >
                  <td className="p-2.5 pl-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 rounded-full border border-border">
                        {memberAvatar && <AvatarImage src={memberAvatar} className="object-cover" />}
                        <AvatarFallback className="bg-muted text-muted-foreground text-[11px] font-medium">
                          {initials || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid overflow-hidden">
                        <span className="font-medium text-foreground truncate">
                          {memberName}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {memberEmail}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-2.5">
                    <RoleDisplay 
                      member={member} 
                      roles={roles || []} 
                      projectCreatorId={project.createdBy?._id || project.createdBy} 
                      workspaceRole={workspaceRole}
                    />
                  </td>
                  <td className="p-2.5 text-muted-foreground text-[12px]">
                    {new Date(
                      member.joinedAt || Date.now(),
                    ).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="p-2.5 text-right pr-4">
                    {canManageTeam &&
                      currentUser &&
                      !isCurrentUser && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted cursor-pointer"
                            >
                              <MoreVertical className="h-4 w-4 text-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded-lg">
                            <DropdownMenuRadioGroup
                              value={getRoleName(member).toLowerCase()}
                              onValueChange={(val) =>
                                handleUpdateRole(member.user?._id, val)
                              }
                            >
                              <DropdownMenuRadioItem value="admin" className="text-xs cursor-pointer">Admin</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="member" className="text-xs cursor-pointer">Member</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="viewer" className="text-xs cursor-pointer">Viewer</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                            <DropdownMenuItem
                              className="text-destructive focus:bg-destructive/10 text-xs font-medium cursor-pointer"
                              onClick={() => handleRemoveMember(member.user?._id)}
                            >
                              Remove from Project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredMembers.length === 0 && (
          <div className="p-16 text-center text-muted-foreground text-sm italic">
             No members found matching "{searchTerm}"
          </div>
        )}
        </div>
      </div>

      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        projectId={project._id}
        workspace={workspace}
        existingMemberIds={new Set((project.members || []).map((m: any) => m.user?._id).filter(Boolean))}
      />
    </div>
  );
}

function RoleDisplay({ member, roles, projectCreatorId, workspaceRole }: { member: any, roles: any[], projectCreatorId?: any, workspaceRole?: string }) {
  const roleNameRaw = getRoleName(member);
  
  const isHexId = /^[0-9a-fA-F]{24}$/.test(roleNameRaw);
  let resolvedRoleName = roleNameRaw;

  if (isHexId) {
    const matchedRole = roles.find(r => r._id === roleNameRaw);
    if (matchedRole) {
      resolvedRoleName = matchedRole.name;
    }
  }

  // FORCE ADMIN for creator or workspace owners/admins
  const creatorId = typeof projectCreatorId === 'object' ? projectCreatorId?._id : projectCreatorId;
  const isCreator = member.user?._id === creatorId;
  const isWorkspaceAdmin = (workspaceRole === "owner" || workspaceRole === "admin") && member.user?._id === creatorId;

  if (isCreator || isWorkspaceAdmin || resolvedRoleName.toLowerCase().includes("admin") || resolvedRoleName.toLowerCase().includes("quáº£n trá»‹")) {
    resolvedRoleName = "Admin";
  }

  const roleLower = resolvedRoleName.toLowerCase();
  let textClass = "text-muted-foreground";

  if (roleLower === "admin" || roleLower === "manager" || roleLower === "owner") {
    textClass = "text-foreground font-semibold";
  }

  return (
    <div className={cn("text-[13px] capitalize", textClass)}>
      {resolvedRoleName}
    </div>
  );
}

function AddMemberDialog({
  open,
  onOpenChange,
  projectId,
  workspace,
  existingMemberIds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  workspace: any;
  existingMemberIds: Set<string>;
}) {
  const [search, setSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const addMemberMutation = useAddProjectMember();

  const availableMembers =
    workspace?.members.filter(
      (m: any) =>
        !existingMemberIds.has(m.user?._id) &&
        (m.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
          m.user?.email?.toLowerCase().includes(search.toLowerCase())),
    ) || [];

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleAdd = async () => {
    for (const userId of selectedUsers) {
      await addMemberMutation.mutateAsync({ projectId, userId, role: "member" });
    }
    setSelectedUsers([]);
    onOpenChange(false);
    toast.success("Members added successfully");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-lg border-border shadow-lg p-0 overflow-hidden bg-background">
        <div className="p-5 pb-0">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold text-foreground">Add Members</DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground mt-1">
              Select members from your workspace to add to this project.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search workspace members..."
              className="pl-9 h-9 rounded-lg border-border text-[13px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg divide-y divide-border bg-muted/20">
            {availableMembers.length === 0 ? (
              <div className="p-10 text-center text-[12px] text-muted-foreground italic">
                No members found.
              </div>
            ) : (
              availableMembers.map((m: any) => (
                <div
                  key={m.user?._id}
                  className={`flex items-center p-3 cursor-pointer hover:bg-card transition-all ${selectedUsers.includes(m.user?._id) ? "bg-card" : ""}`}
                  onClick={() => toggleUser(m.user?._id)}
                >
                  <div
                    className={cn(
                      "w-4 h-4 border rounded-md mr-3 flex items-center justify-center transition-all",
                      selectedUsers.includes(m.user?._id) ? "bg-primary border-primary" : "border-muted-foreground/40"
                    )}
                  >
                    {selectedUsers.includes(m.user?._id) && (
                      <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />
                    )}
                  </div>
                  <Avatar className="h-7 w-7 mr-3 rounded-full border border-border">
                    <AvatarImage src={m.user?.avatar} className="object-cover" />
                    <AvatarFallback className="text-[10px] font-medium bg-muted text-muted-foreground">
                      {m.user?.name?.split(' ').map((n: any) => n[0]).join('').slice(0, 2).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[13px] font-medium truncate text-foreground">
                      {m.user?.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {m.user?.email}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/40 border-t border-border flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground h-8 px-4 cursor-pointer rounded-lg">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={selectedUsers.length === 0 || addMemberMutation.isPending}
            className="h-8 px-6 cursor-pointer rounded-lg"
          >
            {addMemberMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
