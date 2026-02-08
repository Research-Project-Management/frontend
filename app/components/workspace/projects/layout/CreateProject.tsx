import React, { useState } from "react";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";

export default function CreateProject({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    avatar: "📁",
    description: "",
    modules: ["overview", "tasks", "pages", "storage", "settings"] as string[],
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const availableModules = [
    { id: "overview", label: "Overview", isDefault: true },
    { id: "tasks", label: "Tasks", isDefault: true },
    { id: "pages", label: "Pages", isDefault: true },
    { id: "storage", label: "Storage", isDefault: true },
    { id: "settings", label: "Settings", isDefault: true },
  ];

  const handleModuleToggle = (moduleId: string) => {
    setFormData((prev) => ({
      ...prev,
      modules: prev.modules.includes(moduleId)
        ? prev.modules.filter((m) => m !== moduleId)
        : [...prev.modules, moduleId],
    }));
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setFormData((prev) => ({ ...prev, avatar: emojiData.emoji }));
    setShowEmojiPicker(false);
  };

  const mutation = useMutation({
    mutationFn: async (newProject: typeof formData) => {
      const response = await fetch(
        import.meta.env.VITE_API_URL + `/api/workspace/${workspaceId}/project`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(newProject),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to create project");
      }
      return response.json();
    },
    onSuccess(data) {
      console.log("Project created:", data);
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
      setFormData({
        name: "",
        avatar: "📁",
        description: "",
        modules: ["overview", "tasks", "pages", "storage", "settings"],
      });
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Creating project:", formData);
    mutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field>
        <Label htmlFor="name">Project Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="Enter project name"
          required
        />
      </Field>

      <Field>
        <Label htmlFor="avatar">Avatar</Label>
        <div className="relative">
          <div
            className="flex items-center justify-center w-16 h-16 text-3xl border rounded-md cursor-pointer hover:bg-accent transition-colors"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            {formData.avatar}
          </div>
          {showEmojiPicker && (
            <div className="absolute z-50 mt-2">
              <EmojiPicker
                emojiStyle={EmojiStyle.NATIVE}
                onEmojiClick={handleEmojiClick}
              />
            </div>
          )}
        </div>
      </Field>

      <Field>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Enter project description"
          rows={3}
        />
      </Field>

      <Field>
        <Label>Modules</Label>
        <div className="space-y-2">
          {availableModules.map((module) => (
            <div key={module.id} className="flex items-center space-x-2">
              <Checkbox
                disabled={module.isDefault}
                id={module.id}
                checked={formData.modules.includes(module.id)}
                onCheckedChange={() => handleModuleToggle(module.id)}
              />
              <Label htmlFor={module.id} className="font-normal cursor-pointer">
                {module.label}
              </Label>
            </div>
          ))}
        </div>
      </Field>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit">Create Project</Button>
      </div>
    </form>
  );
}
