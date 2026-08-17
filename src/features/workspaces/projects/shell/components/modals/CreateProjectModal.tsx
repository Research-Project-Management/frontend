'use client';

import React, { useState, useRef, useEffect } from "react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import { Input, Button, Textarea, Label } from "@/shared/components/ui";
import { useParams } from "next/navigation";
import { useCreateProject } from "../../services/project.service";
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
  | "stickies";

const MODULE_ORDER: ProjectModuleKey[] = [
  "overview",
  "pages",
  "tasks",
  "cycles",
  "storage",
  "stickies",
];

const LOCKED_MODULES: ProjectModuleKey[] = ["overview"];

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
  { id: "stickies", label: "Stickies" },
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
    modules: ["overview", "pages", "tasks", "cycles", "storage"],
    accent: "ring-foreground/80",
  },
  {
    id: "general",
    name: "General Project",
    description: "Standard project management with tasks & files",
    icon: FolderKanban,
    modules: ["overview", "pages", "tasks", "storage"],
    accent: "ring-foreground/80",
  },
  {
    id: "writing",
    name: "Writing & Docs",
    description: "Focus on writing with project stickies",
    icon: BookOpen,
    modules: ["overview", "pages", "storage", "stickies"],
    accent: "ring-foreground/80",
  },
  {
    id: "custom",
    name: "Custom",
    description: "Start from scratch, pick your modules",
    icon: Blocks,
    modules: ["overview"],
    accent: "ring-foreground/80",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateProjectModal({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { workspaceId } = useParams();
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

  const mutation = useCreateProject();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !workspaceId) return;
    mutation.mutate(
      {
        workspaceId: workspaceId as string,
        name: name.trim(),
        avatar,
        description,
        modules: MODULE_ORDER.filter((moduleId) => modules.includes(moduleId)),
      },
      {
        onSuccess: () => {
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
      }
    );
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
                className={`relative flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left transition-all duration-150 cursor-pointer
                  ${
                    isSelected
                      ? `border-transparent ring-2 ${tpl.accent} bg-accent/40`
                      : "border-border hover:border-muted-foreground/30 hover:bg-accent/20"
                  }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-background">
                      <Check className="size-2.5 stroke-[3]" />
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <tpl.icon className="size-4 text-foreground shrink-0" />
                  <span className="text-xs font-semibold text-foreground">
                    {tpl.name}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                  {tpl.description}
                </p>
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
              className="flex items-center justify-center w-12 h-12 text-2xl border border-border hover:border-foreground rounded-lg cursor-pointer hover:bg-accent transition-colors shrink-0"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              {avatar}
            </button>
            {showEmojiPicker && (
              <div 
                className="absolute z-50 mt-2 left-0 shadow-2xl rounded-lg border border-border overflow-hidden"
                style={{ 
                  "--epr-bg-color": "var(--card)",
                  "--epr-category-navigation-button-active-color": "var(--muted-foreground)",
                  "--epr-highlight-color": "var(--muted-foreground)",
                  "--epr-search-input-bg-color": "var(--secondary)",
                  "--epr-search-input-border-color": "var(--border)",
                  "--epr-hover-bg-color": "var(--accent)",
                  "--epr-focus-bg-color": "var(--accent)",
                } as React.CSSProperties}
              >
                <EmojiPicker
                  emojiStyle={EmojiStyle.NATIVE}
                  onEmojiClick={handleEmojiClick}
                  theme={Theme.AUTO}
                  height={350}
                  width={300}
                  lazyLoadEmojis={true}
                  searchPlaceholder="Search emoji..."
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
              className="text-base h-12 border-border focus-visible:border-foreground focus-visible:ring-0"
              autoFocus
            />
          </div>
        </div>

        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a more detailed description..."
          rows={2}
          className="resize-none text-sm border-border focus-visible:border-foreground focus-visible:ring-0 min-h-[100px]"
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
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 border
                  ${
                    isActive
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                  }
                  ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                {isLocked && <Lock className="size-3" />}
                {!isLocked && isActive && <Check className="size-3" />}
                {mod.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────── */}
      <div className="flex gap-2 justify-end pt-1">
        <Button type="submit" disabled={mutation.isPending || !name.trim()} className="cursor-pointer">
          {mutation.isPending ? "Creating..." : "Create Project"}
        </Button>
      </div>
    </form>
  );
}

export default CreateProjectModal;
