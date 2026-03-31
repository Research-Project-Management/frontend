import { useState, useRef } from "react";
import { Camera, Loader2, Lock, User, Github } from "lucide-react";
import { toast } from "sonner";

import TopBar from "../layout/TopBar";
import { useAuth } from "~/hooks/useAuth";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { API_URL } from "~/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "~/components/ui/skeleton";
import { useUpload } from "~/hooks/useUpload";
import { Avatar } from "../../layout/Avatar";
import { useEffect } from "react";
import { apiPut } from "~/lib/api";

export default function ProfilePage() {
  const { user, isLoading: isLoadingUser } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const { uploadAvatar, isUploading } = useUpload();
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync state when user data loads/changes
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setAvatar(user.avatar || "");
    }
  }, [user]);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const initial = (user?.name || "U").charAt(0).toUpperCase();
  const isOAuth = !!(user as any)?.googleId || !!(user as any)?.githubId;

  const handleAvatarUpload = async (file: File) => {
    try {
      const finalUrl = await uploadAvatar(file);
      setAvatar(finalUrl);

      // Auto-save avatar change to backend
      await apiPut("/auth/profile", { 
        name: (name || user?.name || "").trim(), 
        avatar: finalUrl 
      });

      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast.success("Avatar updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload avatar");
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsSaving(true);
    try {
      await apiPut("/auth/profile", { 
        name: name.trim(), 
        avatar: avatar || null 
      });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoadingUser || !user) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <TopBar
          title="Profile"
          description="Manage your personal profile and security."
        />
        <div className="flex-1 p-8 space-y-8 max-w-3xl">
          <div className="flex items-center gap-6">
            <Skeleton className="size-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <hr className="border-border" />
          <div className="space-y-5">
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-2 gap-6">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Profile"
        description="Manage your personal profile and security."
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 space-y-8 max-w-3xl">
          {/* Avatar + Name section */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="relative group size-20 shrink-0 rounded-full flex items-center justify-center text-3xl font-semibold overflow-hidden transition-opacity hover:opacity-90 cursor-pointer"
            >
              <Avatar
                src={avatar}
                name={user.name!}
                className="size-full"
                fallbackType="user"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploading ? (
                  <Loader2 className="size-5 text-white animate-spin" />
                ) : (
                  <Camera className="size-5 text-white" />
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                }}
              />
            </button>

            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {isOAuth && (
                <div className="flex items-center gap-1 mt-1">
                  {(user as any)?.googleId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-medium">
                      Google
                    </span>
                  )}
                  {(user as any)?.githubId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-500/10 text-gray-600 font-medium flex items-center gap-0.5">
                      <Github className="size-3" /> GitHub
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <hr className="border-border" />

          {/* Profile form */}
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="size-4" />
              Personal Information
            </h3>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Full Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Email
                </label>
                <Input value={user.email || ""} disabled className="opacity-60" />
              </div>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={isSaving || name === user.name && avatar === (user.avatar || "")}
              size="sm"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : null}
              Save Changes
            </Button>
          </div>

          <hr className="border-border" />

          {/* Change password */}
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lock className="size-4" />
              Change Password
            </h3>

            <div className="grid grid-cols-1 gap-4 max-w-sm">
              {!isOAuth && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  New Password
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !newPassword || !confirmPassword}
              variant="outline"
              size="sm"
            >
              {isChangingPassword ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : null}
              Change Password
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
