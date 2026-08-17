'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Textarea } from '@/shared/components/ui';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui';
import { ArrowUp, Square, Globe, X, Plus, ChevronDown } from 'lucide-react';
import { Switch } from '@/shared/components/ui';
import { useProjects } from '@/features/workspaces/projects/shell/services/project.service';
import { useParams } from 'next/navigation';
import { useWorkspace } from '@/features/workspaces/shell';
import { AGENT_CONFIGS } from '../../types/chat.types';
import type { AgentId } from '../../types/chat.types';

const PROJ_DOTS = ['#3370ff', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#06b6d4'];
function projDot(i: number) { return PROJ_DOTS[i % PROJ_DOTS.length]; }

const DEFAULT_ACADEMIC_SITES = [
  'arxiv.org',
  'ieeexplore.ieee.org',
  'dl.acm.org',
  'pubmed.ncbi.nlm.nih.gov',
  'semanticscholar.org',
  'scholar.google.com',
  'springer.com',
  'nature.com',
  'sciencedirect.com',
  'researchgate.net',
  'aclanthology.org',
  'openreview.net',
  'zenodo.org',
  'proceedings.mlr.press',
  'proceedings.neurips.cc',
  'biorxiv.org',
  'medrxiv.org',
];

export interface ChatInputProps {
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

export function ChatInput({
  onSend,
  disabled,
  initialProject,
  initialMessage,
  initialAgent,
  initialWebSearch,
}: ChatInputProps) {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { workspace } = useWorkspace(workspaceId);
  const { projects } = useProjects();
  const [message, setMessage] = useState(initialMessage || '');
  const [webSearch, setWebSearch] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>(initialProject || 'workspace');
  const [sites, setSites] = useState<string[]>(DEFAULT_ACADEMIC_SITES);
  const [newSite, setNewSite] = useState('');
  const [mentionedAgent, setMentionedAgent] = useState<AgentId | null>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  useEffect(() => {
    const t = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(t);
  }, [initialProject, initialMessage]);

  useEffect(() => {
    setMessage(initialMessage || '');
  }, [initialMessage]);

  useEffect(() => {
    setMentionedAgent(initialAgent ?? null);
  }, [initialAgent]);

  useEffect(() => {
    setWebSearch(Boolean(initialWebSearch));
  }, [initialWebSearch]);

  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  // Focus-on-type
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.key.length === 1 && e.key !== ' ') {
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled]);

  useEffect(() => {
    if (initialProject) {
      setSelectedProject(initialProject);
    } else {
      setSelectedProject('workspace');
    }
  }, [initialProject]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMentionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);

    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt >= 0) {
      const textAfterAt = textBeforeCursor.slice(lastAt + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
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
      mentionQuery === '' ||
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
    const finalProjectId = selectedProject === 'workspace' || !selectedProject ? undefined : selectedProject;
    onSend?.(
      message.trim(),
      finalProjectId,
      webSearch ? sites : undefined,
      mentionedAgent ?? undefined,
    );
    setMessage('');
    setMentionedAgent(null);
  }, [message, disabled, selectedProject, onSend, webSearch, sites, mentionedAgent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionDropdown && filteredAgents.length > 0) {
      if (e.key === 'Escape') { setShowMentionDropdown(false); e.preventDefault(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((p) => (p + 1) % filteredAgents.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((p) => p <= 0 ? filteredAgents.length - 1 : p - 1); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectAgent(filteredAgents[highlightIdx] ?? filteredAgents[0]); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const addSite = () => {
    const s = newSite.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (s && !sites.includes(s)) setSites((prev) => [...prev, s]);
    setNewSite('');
  };

  const removeSite = (site: string) => {
    setSites((prev) => prev.filter((s) => s !== site));
  };

  const selectedAgentConfig = AGENT_CONFIGS.find((a) => a.id === mentionedAgent);

  return (
    <div className="w-full max-w-3xl mx-auto relative">
      {/* Mention dropdown */}
      {showMentionDropdown && filteredAgents.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full mb-2 left-0 z-50 w-72 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md shadow-xl overflow-hidden p-1.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Mention Agent
          </div>
          {filteredAgents.map((agent, i) => (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                i === highlightIdx
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-foreground'
              }`}
            >
              <span className={`size-2 rounded-full ${agent.color.replace('text-', 'bg-')}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">{agent.label}</div>
                <div className="text-[10px] text-muted-foreground truncate">{agent.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main chat input container */}
      <div className="relative rounded-2xl border border-border/60 bg-muted/40 dark:bg-zinc-900/50 shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 focus-within:bg-background transition-all">
        {/* Selected agent pill */}
        {selectedAgentConfig && (
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${selectedAgentConfig.bg} ${selectedAgentConfig.color} border ${selectedAgentConfig.border}`}>
              <span>@{selectedAgentConfig.label}</span>
              <button
                type="button"
                onClick={clearAgent}
                className="hover:opacity-75 focus:outline-none"
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        )}

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything, type @ to mention an agent..."
          disabled={disabled}
          className="w-full min-h-[52px] max-h-[200px] border-0 bg-transparent px-4 py-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 resize-none placeholder:text-muted-foreground/60"
        />

        {/* Action bar */}
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Project Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{
                      backgroundColor:
                        selectedProject === 'workspace' || !selectedProject
                          ? '#a1a1aa'
                          : projDot(
                              (projects || []).findIndex((p) => p._id === selectedProject),
                            ),
                    }}
                  />
                  <span className="max-w-[120px] truncate">
                    {selectedProject === 'workspace' || !selectedProject
                      ? workspace?.name || 'Workspace'
                      : (projects || []).find((p) => p._id === selectedProject)?.name || 'Project'}
                  </span>
                  <ChevronDown className="size-3 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1.5">
                <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                  Scope Context
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProject('workspace')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left ${
                    selectedProject === 'workspace'
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'hover:bg-accent/50 text-foreground'
                  }`}
                >
                  <span className="size-2 rounded-full bg-zinc-400" />
                  <span className="truncate">{workspace?.name || 'Whole Workspace'}</span>
                </button>
                {(projects || []).map((proj, idx) => (
                  <button
                    key={proj._id}
                    type="button"
                    onClick={() => setSelectedProject(proj._id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left ${
                      selectedProject === proj._id
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'hover:bg-accent/50 text-foreground'
                    }`}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: projDot(idx) }} />
                    <span className="truncate">{proj.name}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Web Search toggle */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors ${
                    webSearch
                      ? 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium'
                      : 'border-border/60 bg-background/80 text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Globe className="size-3.5" />
                  <span>Web Search</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Globe className="size-4 text-sky-500" />
                    <span className="text-xs font-semibold">Web Search Sources</span>
                  </div>
                  <Switch checked={webSearch} onCheckedChange={setWebSearch} />
                </div>
                <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                  Search academic repositories and the web for current literature and references.
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {sites.map((site) => (
                    <div
                      key={site}
                      className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-secondary/50"
                    >
                      <span className="truncate">{site}</span>
                      <button
                        type="button"
                        onClick={() => removeSite(site)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-2.5">
                  <input
                    type="text"
                    value={newSite}
                    onChange={(e) => setNewSite(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSite();
                      }
                    }}
                    placeholder="Add domain (e.g. nature.com)"
                    className="flex-1 h-7 text-xs px-2 rounded border border-border bg-background"
                  />
                  <button
                    type="button"
                    onClick={addSite}
                    className="h-7 px-2 rounded bg-primary text-primary-foreground text-xs hover:opacity-90"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Send / Stop button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!message.trim() && !disabled}
            className={`inline-flex size-8 items-center justify-center rounded-xl transition-all ${
              message.trim() && !disabled
                ? 'bg-primary text-primary-foreground shadow hover:opacity-90 hover:scale-105 active:scale-95'
                : disabled
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-muted text-muted-foreground/50 cursor-default'
            }`}
          >
            {disabled ? <Square className="size-3.5 fill-current" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// Backward compatibility alias
export default ChatInput;
