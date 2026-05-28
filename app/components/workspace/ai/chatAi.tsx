import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "~/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ArrowUp, Square, Globe, X, Plus, ChevronDown } from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { useProjects } from "~/hooks/useWorkspace";
import { useParams } from "react-router";
import { useWorkspace } from "~/query/workspace";
import { AGENT_CONFIGS } from "~/types/chat";
import type { AgentId } from "~/types/chat";
import { toast } from "sonner";

// Stable color cycle for projects — dot only, no new icons
const PROJ_DOTS = ["#3370ff", "#f97316", "#22c55e", "#a855f7", "#ef4444", "#06b6d4"];
function projDot(i: number) { return PROJ_DOTS[i % PROJ_DOTS.length]; }

const DEFAULT_ACADEMIC_SITES = [
  // Primary academic sources
  "arxiv.org",
  "ieeexplore.ieee.org",
  "dl.acm.org",
  "pubmed.ncbi.nlm.nih.gov",
  "semanticscholar.org",
  "scholar.google.com",
  // Publishers
  "springer.com",
  "nature.com",
  "sciencedirect.com",
  "researchgate.net",
  // Conference proceedings & preprints
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
    webSearchSites?: string[],
    intentHint?: string,
  ) => void;
  disabled?: boolean;
  initialProject?: string;
  initialMessage?: string;
  initialAgent?: AgentId | null;
  initialWebSearch?: boolean;
}

export default function ChatAi({
  onSend,
  disabled,
  initialProject,
  initialMessage,
  initialAgent,
  initialWebSearch,
}: ChatAiProps) {
  const { workspaceId } = useParams();
  const { workspace } = useWorkspace(workspaceId!);
  const { projects, isLoading } = useProjects();
  const [message, setMessage] = useState(initialMessage || "");
  const [webSearch, setWebSearch] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>(initialProject || "workspace");
  const [sites, setSites] = useState<string[]>(DEFAULT_ACADEMIC_SITES);
  const [newSite, setNewSite] = useState("");
  const [mentionedAgent, setMentionedAgent] = useState<AgentId | null>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [message]);

  // Auto-focus on mount and active workspace / message change
  useEffect(() => {
    const t = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(t);
  }, [initialProject, initialMessage]);

  useEffect(() => {
    setMessage(initialMessage || "");
  }, [initialMessage]);

  useEffect(() => {
    setMentionedAgent(initialAgent ?? null);
  }, [initialAgent]);

  useEffect(() => {
    setWebSearch(Boolean(initialWebSearch));
  }, [initialWebSearch]);

  // Re-focus after streaming finishes
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  // Focus-on-type: Automatically focus the chat input when the user starts typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.key.length === 1 && e.key !== " ") {
        textareaRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [disabled]);

  // Sync selectedProject when initialProject changes
  useEffect(() => {
    if (initialProject) {
      setSelectedProject(initialProject);
    } else {
      setSelectedProject("workspace");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject]);

  // Close @mention dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMentionDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);

    // Detect @ trigger
    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf("@");

    if (lastAt >= 0) {
      const textAfterAt = textBeforeCursor.slice(lastAt + 1);
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionStart(lastAt);
        setMentionQuery(textAfterAt.toLowerCase());
        setShowMentionDropdown(true);
        setHighlightIdx(0);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const filteredAgents = AGENT_CONFIGS.filter(
    (a) =>
      mentionQuery === "" ||
      a.id.includes(mentionQuery) ||
      a.label.toLowerCase().includes(mentionQuery),
  );

  const selectAgent = (agent: (typeof AGENT_CONFIGS)[number]) => {
    if (mentionStart >= 0) {
      const before = message.slice(0, mentionStart);
      const after = message.slice(mentionStart + 1 + mentionQuery.length);
      setMessage((before + after).trimStart());
    }
    setMentionedAgent(agent.id);
    setShowMentionDropdown(false);
    setHighlightIdx(0);
    textareaRef.current?.focus();
  };

  const clearAgent = () => setMentionedAgent(null);

  const handleSend = useCallback(() => {
    if (!message.trim() || disabled) return;
    const finalProjectId = selectedProject === "workspace" || !selectedProject ? undefined : selectedProject;
    onSend?.(
      message.trim(),
      finalProjectId,
      webSearch ? sites : undefined,
      mentionedAgent ?? undefined,
    );
    setMessage("");
    setMentionedAgent(null);
  }, [message, disabled, selectedProject, onSend, webSearch, sites, mentionedAgent]);




  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionDropdown && filteredAgents.length > 0) {
      if (e.key === "Escape") { setShowMentionDropdown(false); e.preventDefault(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx((p) => (p + 1) % filteredAgents.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx((p) => p <= 0 ? filteredAgents.length - 1 : p - 1); return; }
      if (e.key === "Enter") { e.preventDefault(); selectAgent(filteredAgents[highlightIdx] ?? filteredAgents[0]); return; }
      if (e.key === "Tab") { e.preventDefault(); selectAgent(filteredAgents[highlightIdx] ?? filteredAgents[0]); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleQuickPrompt = (prompt: string) => {
    setMessage(prompt);
    textareaRef.current?.focus();
  };

  const addSite = () => {
    const s = newSite.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (s && !sites.includes(s)) setSites((prev) => [...prev, s]);
    setNewSite("");
  };

  const removeSite = (site: string) => setSites((prev) => prev.filter((s) => s !== site));

  if (isLoading || !projects) return null;

  const activeAgent = mentionedAgent ? AGENT_CONFIGS.find((a) => a.id === mentionedAgent) : null;

  // Scope picker derived state
  const isWorkspace = selectedProject === "workspace" || !selectedProject;
  const activeProject = isWorkspace ? null : projects.find((p: any) => p._id === selectedProject);
  const projectIndex = activeProject ? projects.findIndex((p: any) => p._id === selectedProject) : -1;
  const scopeDot = activeProject ? projDot(projectIndex) : "#9aa0a6";

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      <div className="relative w-full group">
        {/* @mention dropdown */}
        {showMentionDropdown && filteredAgents.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute bottom-full mb-2 left-4 z-50 w-72 rounded-md border border-border bg-popover shadow-xl overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
          >
            <div className="px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Mention Agent
              </p>
            </div>
            {filteredAgents.map((agent, i) => (
              <button
                key={agent.id}
                onClick={() => selectAgent(agent)}
                onMouseEnter={() => setHighlightIdx(i)}
                className={`w-full flex items-center gap-3 px-3 py-2 transition-colors text-left ${
                  i === highlightIdx ? "bg-accent/80" : "hover:bg-accent/60"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground/80">@{agent.label}</span>
                  <p className="text-[10px] text-muted-foreground truncate">{agent.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="relative rounded-2xl border border-border bg-background shadow-sm transition-shadow duration-300 focus-within:shadow-md focus-within:border-primary/30">
          <div className="flex items-center gap-2 px-3 pt-3">

            {/* ── Scope picker ── */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors text-xs font-medium text-foreground/80 min-w-0 max-w-[160px]"
                >
                  {activeProject?.avatar ? (
                    <span className="text-[11px] leading-none shrink-0">{activeProject.avatar}</span>
                  ) : (
                    <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: scopeDot }} />
                  )}
                  <span className="truncate">
                    {activeProject ? activeProject.name : (workspace?.name || "Workspace")}
                  </span>
                  <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>

              <PopoverContent side="top" align="start" className="w-44 p-1">
                {/* Workspace option */}
                <button
                  type="button"
                  onClick={() => setSelectedProject("workspace")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${
                    isWorkspace
                      ? "bg-accent font-semibold text-foreground"
                      : "text-foreground/70 hover:bg-accent/60"
                  }`}
                >
                  <span className="size-1.5 rounded-full bg-[#9aa0a6] shrink-0" />
                  <span className="truncate">{workspace?.name || "Workspace"}</span>
                </button>

                {/* Separator */}
                {projects.length > 0 && (
                  <div className="my-1 mx-2 border-t border-border/60" />
                )}

                {/* Project options */}
                {projects.map((project: any, i: number) => {
                  const isActive = selectedProject === project._id;
                  const color = projDot(i);
                  return (
                    <button
                      key={project._id}
                      type="button"
                      onClick={() => setSelectedProject(project._id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${
                        isActive
                          ? "bg-accent font-semibold text-foreground"
                          : "text-foreground/70 hover:bg-accent/60"
                      }`}
                    >
                      {project.avatar ? (
                        <span className="text-[11px] leading-none shrink-0">{project.avatar}</span>
                      ) : (
                        <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      )}
                      <span className="truncate">{project.name}</span>
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>

            {/* Active agent badge */}
            {activeAgent && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border/60 bg-secondary/50 text-xs font-medium text-foreground/80 transition-all animate-in fade-in-0 zoom-in-95 duration-200">
                <span>@{activeAgent.label}</span>
                <button
                  onClick={clearAgent}
                  className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}

            {/* Hint text */}
            {!activeAgent && (
              <span className="text-[10px] text-muted-foreground/40 ml-auto mr-1 hidden sm:block">
                Type @ to mention an agent
              </span>
            )}
          </div>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            rows={1}
            className="border-none shadow-none focus-visible:ring-0 resize-none min-h-[44px] max-h-[200px] px-4 py-3 text-sm placeholder:text-muted-foreground/50"
            placeholder={
              activeAgent
                ? `Ask ${activeAgent.label} anything...`
                : "Ask anything about your project..."
            }
          />

          {/* Quick-action chips — when agent selected and input is empty */}
          {activeAgent && !message.trim() && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2 animate-in fade-in-0 duration-200">
              {activeAgent.quickPrompts.slice(0, 4).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border/50 bg-secondary/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Bottom row */}
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-2">
              {/* Web search toggle */}
              <Switch
                checked={webSearch}
                onCheckedChange={setWebSearch}
                className="data-[state=checked]:bg-primary scale-[0.7]"
              />
              <span className="text-[11px] font-medium text-muted-foreground">Web</span>

              {/* Site filter popover */}
              {webSearch && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 text-[11px] text-primary/80 hover:text-primary px-2 py-1 rounded-lg bg-primary/8 hover:bg-primary/15 transition-colors">
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
                            onClick={() => removeSite(site)}
                            className="shrink-0 opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 pt-1 border-t border-border/60">
                      <input
                        value={newSite}
                        onChange={(e) => setNewSite(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addSite()}
                        placeholder="e.g. nature.com"
                        className="flex-1 text-xs bg-secondary/40 rounded-lg px-2 py-1.5 border border-border/60 focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground/50"
                      />
                      <button
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
              onClick={handleSend}
              disabled={!message.trim() || disabled}
              className="size-8 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            >
              {disabled ? (
                <Square className="size-3.5" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
