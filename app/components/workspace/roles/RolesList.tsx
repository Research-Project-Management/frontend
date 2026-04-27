import { useState } from "react";
import { useParams, Link } from "react-router";
import {
  useRoles,
  useCreateRole,
  useDeleteRole,
  useDuplicateRole,
} from "~/query/role";
import { useWorkspace } from "~/query/workspace";
import {
  Shield,
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Copy,
  Edit,
  Users,
  Lock,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import type { Role } from "~/types/role";

export default function WorkspaceRolesPage() {
  const { workspaceId: workspaceUrl } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState({
    name: "",
    description: "",
    color: "#6366f1",
  });

  // Fetch data
  const {
    workspace,
    isLoading: workspaceLoading,
    yourRole,
  } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id;
  const { data: rolesData, isLoading: rolesLoading } = useRoles(workspaceId!);
  const roles = Array.isArray(rolesData) ? rolesData : [];

  // Mutations
  const createRoleMutation = useCreateRole(workspaceId!);
  const deleteRoleMutation = useDeleteRole(workspaceId!);
  const duplicateRoleMutation = useDuplicateRole(workspaceId!);

  if (workspaceLoading || rolesLoading) {
    return (
      <div className="flex-1 p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <Skeleton className="h-9 w-56 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }
  if (!workspace) return <div className="p-6 text-muted-foreground">Workspace not found</div>;

  const filteredRoles =
    roles.filter(
      (role: Role) =>
        role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.description?.toLowerCase().includes(searchTerm.toLowerCase()),
    );

  const canManage = yourRole === "owner" || yourRole === "admin";

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) return;

    try {
      await createRoleMutation.mutateAsync({
        name: newRole.name,
        description: newRole.description,
        permissions: [],
        color: newRole.color,
      });
      setCreateDialogOpen(false);
      setNewRole({ name: "", description: "", color: "#6366f1" });
    } catch (error) {
      console.error("Failed to create role:", error);
      alert(error instanceof Error ? error.message : "Failed to create role");
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete the role "${roleName}"?`))
      return;

    try {
      await deleteRoleMutation.mutateAsync(roleId);
    } catch (error) {
      console.error("Failed to delete role:", error);
      alert(error instanceof Error ? error.message : "Failed to delete role");
    }
  };

  const handleDuplicateRole = async (roleId: string) => {
    try {
      await duplicateRoleMutation.mutateAsync(roleId);
    } catch (error) {
      console.error("Failed to duplicate role:", error);
      alert(
        error instanceof Error ? error.message : "Failed to duplicate role",
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-border">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Roles & Permissions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage roles and permissions for "{workspace.name}"
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search roles…"
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoles.map((role: Role) => (
            <div
              key={role._id}
              className="border rounded-lg p-4 hover:border-primary/20 transition-colors bg-card"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="size-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${role.color}20` }}
                  >
                    <Shield className="size-5" style={{ color: role.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      {role.name}
                      {role.isSystem && (
                        <Lock className="size-3 text-muted-foreground" />
                      )}
                    </h3>
                    {role.isDefault && (
                      <Badge variant="secondary" className="text-xs mt-0.5">
                        Default
                      </Badge>
                    )}
                  </div>
                </div>

                {canManage && !role.isSystem && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/${workspaceUrl}/settings/roles/${role._id}`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDuplicateRole(role._id)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDeleteRole(role._id, role.name)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {role.description || "No description"}
              </p>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{role.permissions.length} permissions</span>
                {!role.isSystem && (
                  <Link
                    to={`/${workspaceUrl}/settings/roles/${role._id}`}
                    className="text-primary hover:underline"
                  >
                    View details →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Role Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Create a custom role with specific permissions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Content Editor"
                value={newRole.name}
                onChange={(e) =>
                  setNewRole({ ...newRole, name: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this role can do..."
                value={newRole.description}
                onChange={(e) =>
                  setNewRole({ ...newRole, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="color"
                  type="color"
                  value={newRole.color}
                  onChange={(e) =>
                    setNewRole({ ...newRole, color: e.target.value })
                  }
                  className="w-20 h-10"
                />
                <span className="text-sm text-muted-foreground">
                  Choose a color for this role
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateRole}
              disabled={!newRole.name.trim() || createRoleMutation.isPending}
            >
              {createRoleMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
