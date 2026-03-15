import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { useRole, useUpdateRole } from "~/query/role";
import { useWorkspace } from "~/query/workspace";
import {
  Shield,
  ArrowLeft,
  Save,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { RESOURCES, ACTIONS, type Permission } from "~/types/role";

export default function RoleDetailPage() {
  const { workspaceId: workspaceUrl, roleId } = useParams();
  const navigate = useNavigate();

  const { workspace, isLoading: workspaceLoading } = useWorkspace(
    workspaceUrl!,
  );
  const workspaceId = workspace?._id;
  const { data: role, isLoading: roleLoading } = useRole(workspaceId!, roleId!);
  const updateRoleMutation = useUpdateRole(workspaceId!);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#6366f1",
    permissions: [] as Permission[],
  });

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || "",
        color: role.color,
        permissions: role.permissions || [],
      });
    }
  }, [role]);

  if (workspaceLoading || roleLoading) {
    return (
      <div className="flex-1 p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-9 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }
  if (!workspace || !role) return <div className="p-6 text-muted-foreground">Role not found</div>;

  const hasPermission = (resource: string, action: string) => {
    const perm = formData.permissions.find((p) => p.resource === resource);
    return perm?.actions.includes(action) || false;
  };

  const togglePermission = (resource: string, action: string) => {
    setFormData((prev) => {
      const permissions = [...prev.permissions];
      const permIndex = permissions.findIndex((p) => p.resource === resource);

      if (permIndex === -1) {
        // Tạo mới permission cho resource
        permissions.push({ resource, actions: [action] });
      } else {
        const perm = permissions[permIndex];
        if (perm.actions.includes(action)) {
          // Remove action
          perm.actions = perm.actions.filter((a) => a !== action);
          if (perm.actions.length === 0) {
            permissions.splice(permIndex, 1);
          }
        } else {
          // Add action
          perm.actions.push(action);
        }
      }

      return { ...prev, permissions };
    });
  };

  const toggleAllForResource = (resource: string) => {
    const allActions = ACTIONS.map((a) => a.value);
    const currentPerm = formData.permissions.find(
      (p) => p.resource === resource,
    );
    const hasAll =
      currentPerm && currentPerm.actions.length === allActions.length;

    setFormData((prev) => {
      const permissions = [...prev.permissions];
      const permIndex = permissions.findIndex((p) => p.resource === resource);

      if (hasAll) {
        // Remove all
        if (permIndex !== -1) {
          permissions.splice(permIndex, 1);
        }
      } else {
        // Add all
        if (permIndex === -1) {
          permissions.push({ resource, actions: allActions });
        } else {
          permissions[permIndex].actions = allActions;
        }
      }

      return { ...prev, permissions };
    });
  };

  const handleSave = async () => {
    try {
      await updateRoleMutation.mutateAsync({
        roleId: roleId!,
        name: formData.name,
        description: formData.description,
        color: formData.color,
        permissions: formData.permissions,
      });
      alert("Role updated successfully!");
    } catch (error) {
      console.error("Failed to update role:", error);
      alert(error instanceof Error ? error.message : "Failed to update role");
    }
  };

  const hasChanges =
    formData.name !== role.name ||
    formData.description !== (role.description || "") ||
    formData.color !== role.color ||
    JSON.stringify(formData.permissions) !== JSON.stringify(role.permissions);

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/${workspaceUrl}/settings/roles`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" style={{ color: formData.color }} />
              {role.name}
              {role.isSystem && (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
            </h1>
            <p className="text-muted-foreground">
              {role.isSystem
                ? "System role - Cannot be modified"
                : "Edit role details and permissions"}
            </p>
          </div>
        </div>

        {!role.isSystem && (
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateRoleMutation.isPending}
          >
            {updateRoleMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      {/* Role Info */}
      {!role.isSystem && (
        <div className="border rounded-lg p-6 space-y-4 bg-card">
          <h2 className="text-lg font-semibold">Role Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="w-20 h-10"
                />
                <Badge style={{ backgroundColor: formData.color }}>
                  {formData.name || "Preview"}
                </Badge>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Permissions */}
      <div className="border rounded-lg p-6 space-y-4 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Permissions
            </h2>
            <p className="text-sm text-muted-foreground">
              {role.isSystem
                ? "View permissions for this role"
                : "Configure what this role can do"}
            </p>
          </div>
          {!role.isSystem && (
            <Badge variant="secondary">
              {formData.permissions.reduce(
                (acc, p) => acc + p.actions.length,
                0,
              )}{" "}
              permissions
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          {RESOURCES.map((resource) => {
            const allActions = ACTIONS.map((a) => a.value);
            const currentPerm = formData.permissions.find(
              (p) => p.resource === resource.value,
            );
            const selectedCount = currentPerm?.actions.length || 0;
            const allSelected = selectedCount === allActions.length;
            const someSelected = selectedCount > 0 && !allSelected;

            return (
              <div
                key={resource.value}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() =>
                        !role.isSystem && toggleAllForResource(resource.value)
                      }
                      disabled={role.isSystem}
                      className={
                        someSelected ? "data-[state=checked]:bg-primary/50" : ""
                      }
                    />
                    <div>
                      <h3 className="font-medium">{resource.label}</h3>
                      <p className="text-xs text-muted-foreground">
                        {resource.description}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {selectedCount}/{allActions.length}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 ml-9">
                  {ACTIONS.map((action) => {
                    const checked = hasPermission(resource.value, action.value);
                    return (
                      <label
                        key={action.value}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                          checked
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted"
                        } ${role.isSystem ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            !role.isSystem &&
                            togglePermission(resource.value, action.value)
                          }
                          disabled={role.isSystem}
                        />
                        <span className="text-sm">
                          {action.icon} {action.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
