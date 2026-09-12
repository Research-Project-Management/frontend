'use client';

import { useState, useRef, useCallback, useEffect } from "react";
import type { KeyboardEvent } from "react";
import { useParams } from "next/navigation";
import { ArrowUp, Globe, ChevronDown, X, Plus, Check } from "lucide-react";

import { Textarea } from "@/shared/components/ui";
import { Switch } from "@/shared/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui";

import { useProjects } from '@/features/workspaces/projects/shell/hooks/use-project';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';

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
  const [selectedProject, setSelectedProject] = useState<string>(() => projects?.[0]?.id || "");
  const [sites, setSites] = useState<string[]>(DEFAULT_ACADEMIC_SITES);
  const [newSite, setNewSite] = useState("");

  useEffect(() => {
    if (!selectedProject && projects && projects.length > 0) {
      setSelectedProject(projects[0].id);
    }
  }, [projects, selectedProject]);

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
    const finalProjectId = selectedProject || (projects?.[0]?.id ?? undefined);
    onSend?.(message.trim(), finalProjectId, webSearch ? sites : undefined);
    setMessage("");
  }, [message, selectedProject, projects, webSearch, sites, onSend]);

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

  const activeProject = projects.find((p: any) => p.id === selectedProject) || (projects.length > 0 ? projects[0] : null);
  const scopeDotClass = activeProject ? "bg-primary" : "bg-muted-foreground";

  return (
    <div className="w-full">
      <div className="relative flex flex-col bg-background border border-border rounded-md focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors duration-200">

        {/* Top row: Scope picker */}
        <div className="flex items-center gap-2 px-3 pt-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Select scope"
                className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-border bg-background transition-colors text-xs font-medium text-foreground min-w-0 max-w-[160px] cursor-pointer"
              >
                <span className={`size-2 rounded-full shrink-0 ${scopeDotClass}`} />
                <span className="truncate">
                  {activeProject ? activeProject.name : "No projects"}
                </span>
                <ChevronDown className="size-3 text-foreground shrink-0 opacity-60 ml-0.5" />
              </button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-56 p-1.5">
              {projects.length > 0 ? (
                projects.map((project: any) => {
                  const isActive = activeProject?.id === project.id;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setSelectedProject(project.id)}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-sm transition-colors cursor-pointer ${
                        isActive ? "bg-muted text-foreground font-medium" : "text-foreground hover:bg-muted"
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
                      {isActive && <Check className="size-3.5 text-primary shrink-0 ml-auto" />}
                    </button>
                  );
                })
              ) : (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  No projects available
                </div>
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
                  <button type="button" className="flex items-center gap-1 text-xs text-primary px-2 py-1 rounded-md bg-primary/8 hover:bg-primary/15 transition-colors cursor-pointer">
                    <Globe className="size-3 shrink-0" />
                    <span>{sites.length} sites</span>
                    <ChevronDown className="size-3 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="start"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                  className="w-72 p-3 space-y-2 bg-popover"
                >
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    Search filter sites
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {sites.map((site) => (
                      <div
                        key={site}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded-md bg-secondary/50 group/item"
                      >
                        <span className="text-xs font-mono truncate">{site}</span>
                        <button
                          aria-label="Remove site"
                          onClick={() => removeSite(site)}
                          className="shrink-0 size-6 flex items-center justify-center opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:bg-muted transition-all"
                        >
                          <X className="size-3 shrink-0" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 pt-1 border-t border-border">
                    <input
                      aria-label="New site URL"
                      value={newSite}
                      onChange={(e) => setNewSite(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSite()}
                      placeholder="e.g. nature.com"
                      className="flex-1 text-xs bg-secondary rounded-md px-2 py-1.5 border border-border focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                    />
                    <button
                      aria-label="Add site"
                      onClick={addSite}
                      disabled={!newSite.trim()}
                      className="size-7 flex items-center justify-center rounded-md bg-secondary hover:bg-muted text-foreground disabled:opacity-50 transition-colors"
                    >
                      <Plus className="size-3.5 shrink-0" />
                    </button>
                  </div>
                  <button
                    onClick={() => setSites(DEFAULT_ACADEMIC_SITES)}
                    className="w-full text-xs text-foreground transition-colors text-center py-0.5"
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
            className="size-8 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed group/btn"
          >
            <ArrowUp className="size-4 group-hover/btn:-translate-y-0.5 transition-transform shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
