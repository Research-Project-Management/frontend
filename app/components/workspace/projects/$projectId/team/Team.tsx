import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import {
  useProjectDetails,
  useAddProjectMember,
  useUpdateProjectMemberRole,
  useRemoveProjectMember,
  type Project,
} from "~/query/project";
import { useWorkspace } from "~/query/workspace";
import { useAuth } from "~/hooks/useAuth";
import {
  MoreVertical,
  UserPlus,
  Search,
  Shield,
  ShieldAlert,
  User,
  Trash2,
  Loader2,
} from "lucide-react";
import Loading from "~/components/ui/Loading";
import { getRoleName, getRoleColor } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";

export default function ProjectTeam() {
  const { projectId, workspaceId: workspaceUrl } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  // Fetch data
  const { data: projectData, isLoading: isProjectLoading } = useProjectDetails(
    projectId!,
  );
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace(
    workspaceUrl!,
  );

  const project = projectData?.project as Project;
  const userRole = projectData?.yourRole; // Role của người đang xem trong project
  const { user: currentUser } = useAuth();

  // Mutations
  const updateRoleMutation = useUpdateProjectMemberRole();
  const removeMemberMutation = useRemoveProjectMember();

  const handleUpdateRole = (userId: string, newRole: string) => {
    updateRoleMutation.mutate(
      { projectId: projectId!, userId, newRole },
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
        { projectId: projectId!, userId },
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

  if (isProjectLoading || isWorkspaceLoading) return <Loading />;
  if (!project) return <div>Project not found</div>;

  const filteredMembers = project.members.filter(
    (m) =>
      m.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.user.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const canManageTeam =
    userRole === "manager" || userRole === "owner" || userRole === "admin"; // Project manager or Workspace admin/owner

  return (
    <div className="flex-1 p-6 space-y-6 flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Project Team</h1>
          <p className="text-muted-foreground">
            Manage who has access to this project. {project.members.length}{" "}
            {project.members.length === 1 ? "member" : "members"}
          </p>
        </div>
        {canManageTeam && (
          <Button onClick={() => setAddMemberOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search project members..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto border rounded-lg bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10 border-b">
            <tr>
              <th className="text-left p-4 font-medium">User</th>
              <th className="text-left p-4 font-medium">Role</th>
              <th className="text-left p-4 font-medium">Joined</th>
              <th className="p-4 w-[50px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredMembers.map((member) => {
              const roleName = getRoleName(member);
              const roleColor = getRoleColor(member);

              return (
                <tr
                  key={member.user._id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.user.avatar} />
                        <AvatarFallback>
                          {member.user.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid">
                        <span className="font-medium truncate">
                          {member.user.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {member.user.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge
                      variant={
                        roleName.toLowerCase() === "manager"
                          ? "default"
                          : roleName.toLowerCase() === "member"
                            ? "secondary"
                            : "outline"
                      }
                      style={
                        roleColor
                          ? {
                            backgroundColor: `${roleColor}20`,
                            color: roleColor,
                            borderColor: roleColor,
                          }
                          : undefined
                      }
                    >
                      {roleName}
                    </Badge>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(
                      member.joinedAt || Date.now(),
                    ).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    {canManageTeam &&
                      currentUser &&
                      currentUser._id !== member.user._id &&
                      currentUser.email !== member.user.email && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                            <DropdownMenuRadioGroup
                              value={roleName}
                              onValueChange={(val) =>
                                handleUpdateRole(member.user._id, val)
                              }
                            >
                              <DropdownMenuRadioItem value="manager">
                                Manager
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="member">
                                Member
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="viewer">
                                Viewer
                              </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => handleRemoveMember(member.user._id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
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
          <div className="p-12 text-center text-muted-foreground italic">
            No members found matching "{searchTerm}"
          </div>
        )}
      </div>

      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        projectId={projectId!}
        workspace={workspace}
        existingMemberIds={new Set(project.members.map((m) => m.user._id))}
      />
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

  // Filter workspace members who are NOT in the project
  const availableMembers =
    workspace?.members.filter(
      (m: any) =>
        !existingMemberIds.has(m.user._id) &&
        (m.user.name.toLowerCase().includes(search.toLowerCase()) ||
          m.user.email.toLowerCase().includes(search.toLowerCase())),
    ) || [];

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleAdd = async () => {
    let successCount = 0;
    let failCount = 0;

    for (const userId of selectedUsers) {
      try {
        await addMemberMutation.mutateAsync({
          projectId,
          userId,
          role: "member",
        });
        successCount++;
      } catch (e: any) {
        console.error("Failed to add user", userId, e);
        failCount++;
      }
    }

    // Show appropriate toast based on results
    if (successCount > 0 && failCount === 0) {
      toast.success(
        `Successfully added ${successCount} ${successCount === 1 ? "member" : "members"}`,
      );
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(`Added ${successCount} members, but ${failCount} failed`);
    } else if (failCount > 0) {
      toast.error(
        `Failed to add ${failCount} ${failCount === 1 ? "member" : "members"}`,
      );
    }

    setSelectedUsers([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Members to Project</DialogTitle>
          <DialogDescription>
            Select members from your workspace to add to this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workspace members..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto border rounded-md divide-y">
            {availableMembers.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No available members found.
              </div>
            ) : (
              availableMembers.map((m: any) => (
                <div
                  key={m.user._id}
                  className={`flex items-center p-3 cursor-pointer hover:bg-accent transition-colors ${selectedUsers.includes(m.user._id) ? "bg-accent" : ""}`}
                  onClick={() => toggleUser(m.user._id)}
                >
                  <div
                    className={`w-4 h-4 border rounded mr-3 flex items-center justify-center ${selectedUsers.includes(m.user._id) ? "bg-primary border-primary" : "border-muted-foreground"}`}
                  >
                    {selectedUsers.includes(m.user._id) && (
                      <div className="w-2 h-2 bg-white rounded-sm" />
                    )}
                  </div>
                  <Avatar className="h-8 w-8 mr-3">
                    <AvatarImage src={m.user.avatar} />
                    <AvatarFallback>{m.user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium truncate">
                      {m.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.user.email}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Selected: {selectedUsers.length} users
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedUsers.length === 0 || addMemberMutation.isPending}
          >
            {addMemberMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Add Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
