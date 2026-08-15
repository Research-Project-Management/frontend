'use client';

import { useState, useRef, useCallback } from "react";
import type { KeyboardEvent } from "react";
import { useParams } from "next/navigation";
import { ArrowUp, Globe, ChevronDown, X, Plus } from "lucide-react";

import { Textarea } from "@/shared/components/ui";
import { Switch } from "@/shared/components/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui";

import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useProjects } from '@/features/workspaces/projects/shell/services/project.services';

// We use standard semantic tokens instead of hardcoded colors to adhere to DESIGN.md

const DEFAULT_ACADEMIC_SITES = [
  "arxiv.org",
  "ieeexplore.ieee.org",
  "dl.acm.org",
  "pubmed.ncbi.nlm.nih.gov",
  "semanticscholar.org",
  "scholar.google.com",
  "springer.com",
  "nature.com",
  "sciencedirect.com",
  "researchgate.net",
  "aclanthology.org",
  "openreview.net",
  "zenodo.org",
  "proceedings.mlr.press",
  "proceedings.neurips.cc",
  "biorxiv.org",
  "medrxiv.org",
];

interface ChatAiProps {
  onSend?: (
    text: string,
    projectId?: string,
    webSearchSites?: string[]
  ) => void;
}

export default function ChatAi({ onSend }: ChatAiProps) {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { workspace } = useWorkspace(workspaceId);
  const { projects, isLoading } = useProjects();

  const [message, setMessage] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("workspace");
  const [sites, setSites] = useState<string[]>(DEFAULT_ACADEMIC_SITES);
  const [newSite, setNewSite] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, []);

  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    const finalProjectId = selectedProject === "workspace" || !selectedProject ? undefined : selectedProject;
    onSend?.(message.trim(), finalProjectId, webSearch ? sites : undefined);
    setMessage("");
  }, [message, selectedProject, webSearch, sites, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const addSite = useCallback(() => {
    const s = newSite.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (s && !sites.includes(s)) setSites((prev) => [...prev, s]);
    setNewSite("");
  }, [newSite, sites]);

  const removeSite = useCallback((site: string) => {
    setSites((prev) => prev.filter((s) => s !== site));
  }, []);

  if (isLoading || !projects) return null;

  const isWorkspace = selectedProject === "workspace" || !selectedProject;
  const activeProject = isWorkspace ? null : projects.find((p: any) => p._id === selectedProject);
  const projectIndex = activeProject ? projects.findIndex((p: any) => p._id === selectedProject) : -1;
  const scopeDotClass = activeProject ? "bg-primary" : "bg-muted-foreground";

  return (
    <div className="w-full">
      <div className="relative flex flex-col bg-background border border-border/50 rounded-xl focus-within:border-border focus-within:ring-1 focus-within:ring-border/50 hover:border-border transition-all duration-200">

        {/* Top row: Scope picker */}
        <div className="flex items-center gap-2 px-3 pt-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Select scope"
                className="flex items-center gap-1.5 h-7 px-2 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-xs font-medium text-foreground min-w-0 max-w-[160px]"
              >
                {activeProject ? (
                  activeProject.avatar ? (
                    <span className="text-xs leading-none shrink-0">{activeProject.avatar}</span>
                  ) : (
                    <span className={`size-1.5 rounded-full shrink-0 ${scopeDotClass}`} />
                  )
                ) : (
                  <Avatar className="size-4 rounded-full">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-medium leading-none">
                      {(workspace?.name || "W").substring(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className="truncate">
                  {activeProject ? activeProject.name : (workspace?.name || "Workspace")}
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            </PopoverTrigger>

            <PopoverContent side="bottom" align="start" className="w-56 p-2 rounded-xl">
              <div className="px-2 pb-1.5 pt-1 text-xs font-medium text-muted-foreground">
                Ask AI to use data from:
              </div>
              <button
                type="button"
                onClick={() => setSelectedProject("workspace")}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${isWorkspace ? "bg-accent text-foreground font-medium" : "text-foreground hover:bg-accent/60"
                  }`}
              >
                <Avatar className="size-5 rounded-full">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                    {(workspace?.name || "W").substring(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{workspace?.name || "Workspace"}</span>
              </button>

              {projects.length > 0 && (
                <>
                  <div className="px-2 pb-1.5 pt-3 text-xs font-medium text-muted-foreground">
                    Projects
                  </div>
                  {projects.map((project: any, i: number) => {
                    const isActive = selectedProject === project._id;
                    return (
                      <button
                        key={project._id}
                        type="button"
                        onClick={() => setSelectedProject(project._id)}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${isActive ? "bg-accent text-foreground font-medium" : "text-foreground hover:bg-accent/60"
                          }`}
                      >
                        {project.avatar ? (
                          <span className="text-sm leading-none shrink-0 w-5 text-center">{project.avatar}</span>
                        ) : (
                          <div className="size-5 flex items-center justify-center shrink-0">
                            <span className={`size-2 rounded-full shrink-0 ${isActive ? 'bg-primary' : 'bg-muted-foreground'}`} />
                          </div>
                        )}
                        <span className="truncate">{project.name}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Middle row: Textarea */}
        <div className="flex-1 flex flex-col justify-start px-4">
          <Textarea
            aria-label="Message"
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            className="w-full border-none shadow-none focus-visible:ring-0 resize-none bg-transparent px-0 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground"
            placeholder="Ask anything about your project..."
          />
        </div>

        {/* Bottom row: Web toggle & Send */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <div className="flex items-center gap-2">
            <Switch
              aria-label="Toggle web search"
              checked={webSearch}
              onCheckedChange={setWebSearch}
              className="data-[state=checked]:bg-primary scale-[0.7]"
            />
            <span className="text-xs font-medium text-muted-foreground">Web</span>

            {webSearch && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-primary/80 hover:text-primary px-2 py-1 rounded-lg bg-primary/8 hover:bg-primary/15 transition-colors">
                    <Globe className="size-3" />
                    <span>{sites.length} sites</span>
                    <ChevronDown className="size-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-72 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Search filter sites
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {sites.map((site) => (
                      <div
                        key={site}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-secondary/50 group/item"
                      >
                        <span className="text-xs font-mono truncate">{site}</span>
                        <button
                          aria-label="Remove site"
                          onClick={() => removeSite(site)}
                          className="shrink-0 size-6 flex items-center justify-center opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 pt-1 border-t border-border/60">
                    <input
                      aria-label="New site URL"
                      value={newSite}
                      onChange={(e) => setNewSite(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSite()}
                      placeholder="e.g. nature.com"
                      className="flex-1 text-xs bg-secondary/40 rounded-lg px-2 py-1.5 border border-border/60 focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground/50"
                    />
                    <button
                      aria-label="Add site"
                      onClick={addSite}
                      disabled={!newSite.trim()}
                      className="size-7 flex items-center justify-center rounded-lg bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-30 transition-colors"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => setSites(DEFAULT_ACADEMIC_SITES)}
                    className="w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors text-center py-0.5"
                  >
                    Reset to defaults
                  </button>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <button
            aria-label="Send message"
            onClick={handleSend}
            disabled={!message.trim()}
            className="size-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed group/btn"
          >
            <ArrowUp className="size-4 group-hover/btn:-translate-y-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
