import { useEffect, useRef, useState } from "react";
import { User, Camera, Loader2, Github, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import TopBar from "../layout/TopBar";
import { useAuth } from "~/hooks/useAuth";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "~/components/ui/skeleton";
import { useUpload } from "~/hooks/useUpload";
import { Avatar } from "../../layout/Avatar";
import { apiPut } from "~/lib/api";
import { changePassword } from "~/query/user";

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

  const passwordChecks = {
    minLength: newPassword.length >= 6,
    hasLetter: /[A-Za-z]/.test(newPassword),
    hasNumber: /\d/.test(newPassword),
  };
  const isNewPasswordValid =
    passwordChecks.minLength &&
    passwordChecks.hasLetter &&
    passwordChecks.hasNumber;
  const isConfirmMatched = !!confirmPassword && newPassword === confirmPassword;

  const isOAuth = !!(user as any)?.googleId || !!(user as any)?.githubId;
  const hasProfileChanges =
    name.trim() !== (user?.name || "") || avatar !== (user?.avatar || "");
  const canChangePassword =
    !isOAuth &&
    !!currentPassword &&
    !!newPassword &&
    !!confirmPassword &&
    isNewPasswordValid &&
    isConfirmMatched;
  const hasStartedPasswordChange =
    !!currentPassword || !!newPassword || !!confirmPassword;

  const updateCurrentUserCache = (patch: Record<string, unknown>) => {
    queryClient.setQueryData(["currentUser"], (currentUser: any) =>
      currentUser ? { ...currentUser, ...patch } : currentUser
    );
  };

  const handleAvatarUpload = async (file: File) => {
    const previousAvatar = avatar;

    try {
      const finalUrl = await uploadAvatar(file);
      setAvatar(finalUrl);

      await apiPut("/auth/profile", {
        name: (user?.name || "").trim(),
        avatar: finalUrl,
      });
      updateCurrentUserCache({ avatar: finalUrl });
      toast.success("Avatar updated");
    } catch (err: any) {
      setAvatar(previousAvatar || "");
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
        avatar: avatar || null,
      });
      updateCurrentUserCache({ name: name.trim(), avatar: avatar || null });
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (isOAuth) {
      toast.error("Password changes are not available for Google or GitHub accounts.");
      return;
    }

    if (!currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (!isNewPasswordValid) {
      toast.error("Password does not meet all required conditions");
      return;
    }
    if (!isConfirmMatched) {
      toast.error("Passwords do not match");
      return;
    }
    setIsChangingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
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
        <div className="px-4 h-13 border-b border-border flex items-center">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-8 space-y-8 max-w-3xl">
            <div className="flex items-center gap-5">
              <Skeleton className="size-16 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <hr className="border-border" />
            <div className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              </div>
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
        Icon={User}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 space-y-8 max-w-3xl">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="relative group size-16 shrink-0 rounded-xl flex items-center justify-center text-2xl font-semibold overflow-hidden transition-opacity hover:opacity-90 cursor-pointer"
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
                  e.currentTarget.value = "";
                }}
              />
            </button>

            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="text-base font-semibold truncate">
                {user.name}
              </h2>
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

          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Personal information
              </h3>
              <p className="text-sm text-muted-foreground">
                Update your display name and review the email on this account.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label
                  htmlFor="profile-full-name"
                  className="text-sm font-medium text-foreground"
                >
                  Full Name
                </label>
                <Input
                  id="profile-full-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="profile-email"
                  className="text-sm font-medium text-foreground"
                >
                  Email
                </label>
                <Input
                  id="profile-email"
                  value={user.email || ""}
                  readOnly
                  className="bg-muted/50 text-muted-foreground cursor-not-allowed h-10 font-medium"
                />
              </div>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={isSaving || !hasProfileChanges}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : null}
              Update profile
            </Button>
          </div>

          <hr className="border-border" />

          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Security
              </h3>
              <p className="text-sm text-muted-foreground">
                {isOAuth
                  ? "This account signs in with Google or GitHub, so password changes are disabled."
                  : "Change the password you use to sign in to this account."}
              </p>
            </div>

            {isOAuth ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Password management is handled by your social sign-in provider.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="current-password"
                        className="text-sm font-medium text-foreground"
                      >
                        Current Password
                      </label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        autoComplete="current-password"
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="confirm-new-password"
                        className="text-sm font-medium text-foreground"
                      >
                        Confirm New Password
                      </label>
                      <Input
                        id="confirm-new-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && canChangePassword) {
                            e.preventDefault();
                            handleChangePassword();
                          }
                        }}
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="new-password"
                      className="text-sm font-medium text-foreground"
                    >
                      New Password
                    </label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      className="h-10"
                    />
                    {hasStartedPasswordChange ? (
                    <div className="pt-3">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Password requirements
                      </p>
                      <ul className="space-y-1 text-xs">
                        <li className="flex items-center gap-1.5">
                          {passwordChecks.minLength ? (
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="size-3.5 text-red-600" />
                          )}
                          <span className={passwordChecks.minLength ? "text-emerald-700" : "text-red-600"}>
                            At least 6 characters
                          </span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          {passwordChecks.hasLetter ? (
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="size-3.5 text-red-600" />
                          )}
                          <span className={passwordChecks.hasLetter ? "text-emerald-700" : "text-red-600"}>
                            Includes at least one letter
                          </span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          {passwordChecks.hasNumber ? (
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                          ) : (
                            <XCircle className="size-3.5 text-red-600" />
                          )}
                          <span className={passwordChecks.hasNumber ? "text-emerald-700" : "text-red-600"}>
                            Includes at least one number
                          </span>
                        </li>
                      </ul>
                    </div>
                    ) : null}
                  </div>
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !canChangePassword}
                  variant="outline"
                >
                  {isChangingPassword ? (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  ) : null}
                  Change Password
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
