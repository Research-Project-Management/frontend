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
import { ArrowUp, Square, Globe, X, Plus, ChevronDown } from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { useProjects } from "~/hooks/useWorkspace";

const DEFAULT_ACADEMIC_SITES = [
  "arxiv.org",
  "pubmed.ncbi.nlm.nih.gov",
  "semanticscholar.org",
  "ieeexplore.ieee.org",
  "dl.acm.org",
  "springer.com",
  "nature.com",
  "sciencedirect.com",
  "researchgate.net",
];

interface ChatAiProps {
  onSend?: (
    text: string,
    projectId?: string,
    webSearchSites?: string[],
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [message]);

  const handleSend = useCallback(() => {
    if (!message.trim() || disabled) return;
    onSend?.(
      message.trim(),
      selectedProject || undefined,
      webSearch ? sites : undefined,
    );
    setMessage("");
  }, [message, disabled, selectedProject, onSend, webSearch, sites]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      <div className="relative w-full group">
        <div className="relative rounded-2xl border border-border bg-background shadow-sm transition-shadow duration-300 focus-within:shadow-md focus-within:border-primary/30">
          {/* Top row: project selector */}
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
          </div>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="border-none shadow-none focus-visible:ring-0 resize-none min-h-[44px] max-h-[200px] px-4 py-3 text-sm placeholder:text-muted-foreground/50"
            placeholder="Ask anything about your project..."
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
