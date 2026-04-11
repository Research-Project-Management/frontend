import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ArrowUp, Square, Globe, X, Plus, ChevronDown, Zap, Bot } from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { useProjects } from "~/hooks/useWorkspace";

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

/** Available agents that can be @mentioned */
const AGENTS = [
  {
    id: "action",
    label: "Action",
    description: "Workspace ops: tasks, projects, pages",
    icon: "⚡",
    color: "text-amber-500",
    bg: "bg-amber-500/10 hover:bg-amber-500/20",
    border: "border-amber-500/30",
  },
  {
    id: "rag",
    label: "RAG",
    description: "Search your uploaded documents",
    icon: "📄",
    color: "text-blue-500",
    bg: "bg-blue-500/10 hover:bg-blue-500/20",
    border: "border-blue-500/30",
  },
  {
    id: "analyze",
    label: "Analyze",
    description: "Data analysis & research review",
    icon: "🔬",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20",
    border: "border-emerald-500/30",
  },
  {
    id: "latex",
    label: "LaTeX",
    description: "LaTeX code & equation generation",
    icon: "📐",
    color: "text-violet-500",
    bg: "bg-violet-500/10 hover:bg-violet-500/20",
    border: "border-violet-500/30",
  },
  {
    id: "web_search",
    label: "Web Search",
    description: "Search academic & general web",
    icon: "🌐",
    color: "text-sky-500",
    bg: "bg-sky-500/10 hover:bg-sky-500/20",
    border: "border-sky-500/30",
  },
  {
    id: "chat",
    label: "Chat",
    description: "General conversational AI",
    icon: "💬",
    color: "text-muted-foreground",
    bg: "bg-secondary/80 hover:bg-secondary",
    border: "border-border",
  },
] as const;

type AgentId = (typeof AGENTS)[number]["id"];

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
}

export default function ChatAi({ onSend, disabled, initialProject, initialMessage }: ChatAiProps) {
  const { projects, isLoading } = useProjects();
  const [message, setMessage] = useState(initialMessage || "");
  const [webSearch, setWebSearch] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>(initialProject || "");
  const [sites, setSites] = useState<string[]>(DEFAULT_ACADEMIC_SITES);
  const [newSite, setNewSite] = useState("");
  const [mentionedAgent, setMentionedAgent] = useState<AgentId | null>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
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

  // Close dropdown on outside click
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
      // Only trigger if no spaces after @
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionStart(lastAt);
        setMentionQuery(textAfterAt.toLowerCase());
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const filteredAgents = AGENTS.filter(
    (a) =>
      mentionQuery === "" ||
      a.id.includes(mentionQuery) ||
      a.label.toLowerCase().includes(mentionQuery),
  );

  const selectAgent = (agent: (typeof AGENTS)[number]) => {
    // Replace the @query in message with empty string (tag handles the display)
    if (mentionStart >= 0) {
      const before = message.slice(0, mentionStart);
      const after = message.slice(mentionStart + 1 + mentionQuery.length);
      setMessage((before + after).trimStart());
    }
    setMentionedAgent(agent.id);
    setShowMentionDropdown(false);
    textareaRef.current?.focus();
  };

  const clearAgent = () => setMentionedAgent(null);

  const handleSend = useCallback(() => {
    if (!message.trim() || disabled) return;
    onSend?.(
      message.trim(),
      selectedProject || undefined,
      webSearch ? sites : undefined,
      mentionedAgent ?? undefined,
    );
    setMessage("");
    setMentionedAgent(null);
  }, [message, disabled, selectedProject, onSend, webSearch, sites, mentionedAgent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Navigate dropdown with arrows
    if (showMentionDropdown) {
      if (e.key === "Escape") {
        setShowMentionDropdown(false);
        e.preventDefault();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (showMentionDropdown && filteredAgents.length > 0) {
        selectAgent(filteredAgents[0]);
      } else {
        handleSend();
      }
    }
  };

  const addSite = () => {
    const s = newSite
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    if (s && !sites.includes(s)) {
      setSites((prev) => [...prev, s]);
    }
    setNewSite("");
  };

  const removeSite = (site: string) => {
    setSites((prev) => prev.filter((s) => s !== site));
  };

  if (isLoading || !projects) return null;

  const activeAgent = mentionedAgent ? AGENTS.find((a) => a.id === mentionedAgent) : null;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      <div className="relative w-full group">
        {/* @mention dropdown */}
        {showMentionDropdown && filteredAgents.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute bottom-full mb-2 left-4 z-50 w-72 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-border/60">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Mention Agent
              </p>
            </div>
            {filteredAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => selectAgent(agent)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/60 transition-colors text-left group/item"
              >
                <span className="text-lg">{agent.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${agent.color}`}>
                      @{agent.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {agent.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="relative rounded-2xl border border-border bg-background shadow-sm transition-shadow duration-300 focus-within:shadow-md focus-within:border-primary/30">
          {/* Top row: project selector + active agent badge */}
          <div className="flex items-center gap-2 px-3 pt-3">
            <Select
              value={selectedProject || projects[0]?._id}
              onValueChange={setSelectedProject}
            >
              <SelectTrigger
                size="sm"
                className="min-w-[100px] data-[size=sm]:h-7 px-2 text-xs focus-visible:ring-transparent hover:ring-1 ring-primary/10 focus-visible:border-transparent bg-secondary/50 rounded-lg border-none"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project._id} value={project._id}>
                    <div className="flex items-center gap-2">
                      {project.avatar}
                      <span className="font-medium">{project.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Active agent badge */}
            {activeAgent && (
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${activeAgent.bg} ${activeAgent.border} ${activeAgent.color} transition-all`}
              >
                <span>{activeAgent.icon}</span>
                <span>@{activeAgent.label}</span>
                <button
                  onClick={clearAgent}
                  className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}

            {/* Hint text when no agent selected */}
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

          {/* Bottom row */}
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-2">
              {/* Web search toggle */}
              <Switch
                checked={webSearch}
                onCheckedChange={setWebSearch}
                className="data-[state=checked]:bg-primary scale-[0.7]"
              />
              <span className="text-[11px] font-medium text-muted-foreground">
                Web
              </span>

              {/* Site filter popover — only visible when web search is on */}
              {webSearch && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 text-[11px] text-primary/80 hover:text-primary px-2 py-1 rounded-lg bg-primary/8 hover:bg-primary/15 transition-colors">
                      <Globe className="size-3" />
                      <span>{sites.length} sites</span>
                      <ChevronDown className="size-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    className="w-72 p-3 space-y-2"
                  >
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Search filter sites
                    </p>

                    {/* Site list */}
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {sites.map((site) => (
                        <div
                          key={site}
                          className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-secondary/50 group/item"
                        >
                          <span className="text-xs font-mono truncate">
                            {site}
                          </span>
                          <button
                            onClick={() => removeSite(site)}
                            className="shrink-0 opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add new site */}
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

                    {/* Reset to default */}
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
