import React, { useState } from "react";
import { API_URL } from "~/lib/api";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Button } from "../ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Create() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [avatar, setAvatar] = useState<string | null>(
    "https://i.pinimg.com/736x/5f/08/52/5f085214d65b511a9992497e2d818625.jpg",
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const createWorkspace = useMutation({
    mutationFn: async (workspaceData: {
      name: string;
      url: string;
      avatar: string | null;
    }) => {
      const apiUrl = API_URL + "/api/workspace";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(workspaceData),
      });
      const respText = await response.text();
      if (!response.ok) {
        throw new Error("Failed to create workspace: " + respText);
      }
      return respText ? JSON.parse(respText) : null;
    },
    onSuccess(data) {
      const newWorkspace = data?.workspace;

      if (newWorkspace?._id) {
        queryClient.setQueriesData({ queryKey: ["workspaces"] }, (current: any) => {
          if (Array.isArray(current)) {
            const exists = current.some((w: any) => w?._id === newWorkspace._id);
            return exists ? current : [newWorkspace, ...current];
          }

          if (Array.isArray(current?.workspaces)) {
            const exists = current.workspaces.some(
              (w: any) => w?._id === newWorkspace._id,
            );
            return exists
              ? current
              : { ...current, workspaces: [newWorkspace, ...current.workspaces] };
          }

          return current;
        });
      }

      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      const workspaceUrl = `/${data.workspace.url}`;
      navigate(workspaceUrl, { replace: true });
    },
    onError(error: any) {
      setUploadError(error?.message || "Failed to create workspace");
      toast.error(error?.message || "Failed to create workspace");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    try {
      let finalAvatar = avatar;

      // Upload file if user selected one
      if (avatarFile) {
        setIsUploadingAvatar(true);
        // Use API_URL for presign endpoint
        const presignResponse = await fetch(
          API_URL + "/api/files/presign",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              fileName: `avatars/${Date.now()}-${avatarFile.name}`,
            }),
          },
        );

        if (!presignResponse.ok) {
          setIsUploadingAvatar(false);
          setAvatarFile(null);
          setAvatar(null);
          setUploadError("Failed to get upload URL. Please try again.");
          return;
        }

        const { url: presignedUrl, path } = await presignResponse.json();

        const uploadResponse = await fetch(presignedUrl, {
          method: "PUT",
          headers: { "Content-Type": avatarFile.type },
          body: avatarFile,
        });

        if (!uploadResponse.ok) {
          setIsUploadingAvatar(false);
          setAvatarFile(null);
          setAvatar(null);
          setUploadError("File upload failed. Please try again.");
          return;
        }

        finalAvatar = `${API_URL}/api/files/${path}`;
        setIsUploadingAvatar(false);
      }

      const workspaceData = {
        name,
        url: url || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        avatar: finalAvatar,
      };

      createWorkspace.mutate(workspaceData);
    } catch (error) {
      setIsUploadingAvatar(false);
      setAvatarFile(null);
      setAvatar(null);
      setUploadError("Error uploading avatar. Please try again.");
    }
  };

  return (
    <div className="h-fit w-full max-w-5xl mx-auto">
      <form onSubmit={handleSubmit}>
        <FieldSet className="">
          <FieldLegend className="w-full flex justify-between items-end">
            <span className="text-2xl font-bold">Create Your Workspace</span>
            {avatar && (
              <div className="mt-2">
                <img
                  src={avatar}
                  alt="Workspace Avatar"
                  className="h-20 w-20 rounded-md object-cover"
                />
              </div>
            )}
          </FieldLegend>
          <FieldDescription></FieldDescription>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="avatar">
                Avatar <span className="text-red-500">*</span>
              </FieldLabel>
              <div className="space-y-3">
                {/* File Upload Button */}
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="avatarFile"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      if (file.size > 5 * 1024 * 1024) {
                        alert("File size must be less than 5MB");
                        return;
                      }

                      // Just save file and create preview
                      setAvatarFile(file);
                      const previewUrl = URL.createObjectURL(file);
                      setAvatar(previewUrl);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      document.getElementById("avatarFile")?.click()
                    }
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Upload Image"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                  >
                    {showUrlInput ? "Hide" : "Or Enter"} URL
                  </Button>
                </div>

                {showUrlInput && (
                  <Input
                    id="avatar"
                    autoComplete="off"
                    placeholder="https://example.com/image.jpg"
                    aria-invalid={false}
                    value={avatar || ""}
                    onChange={(e) => setAvatar(e.target.value)}
                  />
                )}
                {uploadError && (
                  <FieldError>{uploadError}</FieldError>
                )}
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="name">
                Name your workspace <span className="text-red-500">*</span>
              </FieldLabel>
              <Input
                id="name"
                autoComplete="off"
                placeholder="Something like Team, Company, or Project"
                aria-invalid={false}
                value={name}
                onChange={(e) => {
                  const val = e.target.value;
                  setName(val);
                  // Auto-generate URL slug from name
                  const slug = val
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/\s+/g, "-")
                    .replace(/-+/g, "-");
                  const rand = Math.random().toString(36).substring(2, 8);
                  setUrl(slug ? `${slug}-${rand}` : "");
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="url">Set your workspace URL</FieldLabel>
              <div className="w-full flex items-center">
                <span className="text-base text-muted-foreground tracking-wide mr-1">
                  https://flux.aisq.dev/
                </span>
                <Input
                  id="url"
                  className="font-medium!"
                  autoComplete="off"
                  aria-invalid={false}
                  placeholder="abc123"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              {false && <FieldError>Choose another url.</FieldError>}
            </Field>
            {/* <Field orientation="horizontal">
            <Switch id="newsletter" />
            <FieldLabel htmlFor="newsletter">
              Subscribe to the newsletter
            </FieldLabel>
          </Field> */}
            <Field orientation="horizontal">
              <Button disabled={!name || !url || isUploadingAvatar} type="submit">
                Create Workspace
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => navigate(-1)}
              >
                Go back
              </Button>
              {createWorkspace.isPending && (
                <Loader2 className="ml-2 size-5 animate-spin text-primary" />
              )}
              {createWorkspace.isSuccess && (
                <span className="ml-2 text-primary font-medium">
                  Workspace created. Routing...
                </span>
              )}
              {createWorkspace.isError && (
                <FieldError>
                  Error creating workspace. Please try again.
                </FieldError>
              )}
            </Field>
          </FieldGroup>
        </FieldSet>
      </form>
    </div>
  );
}
