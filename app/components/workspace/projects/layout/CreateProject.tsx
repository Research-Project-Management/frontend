import React, { useState, useRef, useEffect } from "react";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { apiPost } from "~/lib/api";
import {
  FlaskConical,
  FolderKanban,
  BookOpen,
  Blocks,
  Check,
  Lock,
  type LucideIcon,
} from "lucide-react";

// ── Module definitions ────────────────────────────────────────────────────────

type ProjectModuleKey =
  | "overview"
  | "tasks"
  | "cycles"
  | "pages"
  | "storage"
  | "stickies"
  | "settings";

const MODULE_ORDER: ProjectModuleKey[] = [
  "overview",
  "pages",
  "tasks",
  "cycles",
  "storage",
  "stickies",
  "settings",
];

const LOCKED_MODULES: ProjectModuleKey[] = ["overview", "settings"];

const ALL_MODULES: {
  id: ProjectModuleKey;
  label: string;
  locked?: boolean;
}[] = [
  { id: "overview", label: "Overview", locked: true },
  { id: "pages", label: "Pages" },
  { id: "tasks", label: "Tasks" },
  { id: "cycles", label: "Cycles" },
  { id: "storage", label: "Storage" },
  { id: "stickies", label: "Notes" },
  { id: "settings", label: "Settings", locked: true },
];

// ── Template definitions ──────────────────────────────────────────────────────

type Template = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  modules: ProjectModuleKey[];
  accent: string; // tailwind ring color
};

const TEMPLATES: Template[] = [
  {
    id: "research",
    name: "Research Paper",
    description: "Full research workflow with cycles & task tracking",
    icon: FlaskConical,
    modules: ["overview", "pages", "tasks", "cycles", "storage", "settings"],
    accent: "ring-blue-500/60",
  },
  {
    id: "general",
    name: "General Project",
    description: "Standard project management with tasks & files",
    icon: FolderKanban,
    modules: ["overview", "pages", "tasks", "storage", "settings"],
    accent: "ring-emerald-500/60",
  },
  {
    id: "writing",
    name: "Writing & Docs",
    description: "Focus on writing with project notes",
    icon: BookOpen,
    modules: ["overview", "pages", "storage", "stickies", "settings"],
    accent: "ring-amber-500/60",
  },
  {
    id: "custom",
    name: "Custom",
    description: "Start from scratch, pick your modules",
    icon: Blocks,
    modules: ["overview", "settings"],
    accent: "ring-violet-500/60",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateProject({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();
  const emojiRef = useRef<HTMLDivElement>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<string>("research");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("📁");
  const [description, setDescription] = useState("");
  const [modules, setModules] = useState<ProjectModuleKey[]>(() => {
    const selectedModules = new Set(TEMPLATES[0].modules);
    return MODULE_ORDER.filter((moduleId) => selectedModules.has(moduleId));
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template.id);
    setModules(() => {
      const selectedModules = new Set(template.modules);
      return MODULE_ORDER.filter((moduleId) => selectedModules.has(moduleId));
    });
  };

  const handleModuleToggle = (moduleId: ProjectModuleKey) => {
    if (LOCKED_MODULES.includes(moduleId)) return;
    setModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((m) => m !== moduleId)
        : MODULE_ORDER.filter((currentModuleId) =>
            new Set([...prev, moduleId]).has(currentModuleId),
          ),
    );
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setAvatar(emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // ── Mutation ────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: (data: {
      name: string;
      avatar: string;
      description: string;
      modules: string[];
    }) => apiPost(`/api/workspace/${workspaceId}/project`, data),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["projects-header", workspaceId] });
      // Reset
      setName("");
      setAvatar("📁");
      setDescription("");
      setSelectedTemplate("research");
      setModules(() => {
        const selectedModules = new Set(TEMPLATES[0].modules);
        return MODULE_ORDER.filter((moduleId) => selectedModules.has(moduleId));
      });
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate({
      name: name.trim(),
      avatar,
      description,
      modules: MODULE_ORDER.filter((moduleId) => modules.includes(moduleId)),
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Template Selector ──────────────────────────────────────── */}
      <div>
        <Label className="text-sm font-medium text-muted-foreground mb-2 block">
          Template
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((tpl) => {
            const isSelected = selectedTemplate === tpl.id;
            return (
              <button
                type="button"
                key={tpl.id}
                onClick={() => handleTemplateSelect(tpl)}
                className={`relative flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer
                  ${
                    isSelected
                      ? `border-transparent ring-2 ${tpl.accent} bg-accent/40`
                      : "border-border hover:border-muted-foreground/30 hover:bg-accent/20"
                  }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Check className="size-3.5 text-primary" />
                  </div>
                )}
                <tpl.icon
                  className={`size-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                />
                <div>
                  <p
                    className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-foreground/80"}`}
                  >
                    {tpl.name}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                    {tpl.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Project Details ────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex gap-3 items-start">
          {/* Emoji Picker */}
          <div className="relative" ref={emojiRef}>
            <button
              type="button"
              className="flex items-center justify-center w-12 h-12 text-2xl border rounded-xl cursor-pointer hover:bg-accent transition-colors shrink-0"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              {avatar}
            </button>
            {showEmojiPicker && (
              <div className="absolute z-50 mt-2 left-0">
                <EmojiPicker
                  emojiStyle={EmojiStyle.NATIVE}
                  onEmojiClick={handleEmojiClick}
                  height={350}
                  width={300}
                />
              </div>
            )}
          </div>

          {/* Name */}
          <div className="flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              required
              className="text-base h-12"
              autoFocus
            />
          </div>
        </div>

        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a short description (optional)"
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      {/* ── Module Chips ───────────────────────────────────────────── */}
      <div>
        <Label className="text-sm font-medium text-muted-foreground mb-2 block">
          Modules
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_MODULES.map((mod) => {
            const isActive = modules.includes(mod.id);
            const isLocked = mod.locked;
            return (
              <button
                type="button"
                key={mod.id}
                onClick={() => handleModuleToggle(mod.id)}
                disabled={isLocked}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border
                  ${
                    isActive
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                  }
                  ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                {isLocked && <Lock className="size-3" />}
                {!isLocked && isActive && <Check className="size-3" />}
                {!isLocked && !isActive && <div className="w-3 shrink-0" />}
                {mod.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────── */}
      <div className="flex gap-2 justify-end pt-1">
        <Button type="submit" disabled={mutation.isPending || !name.trim()}>
          {mutation.isPending ? "Creating..." : "Create Project"}
        </Button>
      </div>
    </form>
  );
}
