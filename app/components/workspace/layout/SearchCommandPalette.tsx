import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { FileText, FolderOpen, File, Loader2, Folder, StickyNote } from "lucide-react";
import { API_URL } from "~/lib/api";

type SearchResult = {
  type: "project" | "page" | "file" | "folder" | "sticky";
  id: string;
  name: string;
  icon?: string | null;
  projectId?: string;
  projectName?: string;
  content?: string;
  mimeType?: string;
  updatedAt?: string;
};

interface SearchCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SearchCommandPalette({ open, onOpenChange }: SearchCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || !workspaceId) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/api/workspace/${workspaceId}/search?q=${encodeURIComponent(query.trim())}`,
          { credentials: "include", signal: controller.signal },
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!controller.signal.aborted) {
          setResults(data.results || []);
          setSelectedIndex(0);
        }
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, workspaceId]);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      onOpenChange(false);
      if (item.type === "project") {
        navigate(`/${workspaceId}/projects/${item.id}/overview`);
      } else if (item.type === "page") {
        navigate(`/editor/${item.id}`);
      } else if (item.type === "file" || item.type === "folder") {
        navigate(`/${workspaceId}/storage`);
      } else if (item.type === "sticky") {
        navigate(`/${workspaceId}/stickies`);
      }
    },
    [navigate, workspaceId, onOpenChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  const getIcon = (item: SearchResult) => {
    if (item.type === "project") return <FolderOpen className="size-4 text-blue-500" />;
    if (item.type === "page") return <FileText className="size-4 text-amber-500" />;
    if (item.type === "folder") return <Folder className="size-4 text-blue-400" />;
    if (item.type === "sticky") return <StickyNote className="size-4 text-green-500" />;
    return <File className="size-4 text-muted-foreground" />;
  };

  const getLabel = (type: string) => {
    if (type === "project") return "Project";
    if (type === "page") return "Page";
    if (type === "folder") return "Folder";
    if (type === "sticky") return "Sticky";
    return "File";
  };

  if (!open) return null;

  // Group results by type
  const grouped = results.reduce(
    (acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    },
    {} as Record<string, SearchResult[]>,
  );

  let flatIndex = -1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50 w-full max-w-lg animate-in fade-in slide-in-from-top-2 duration-150">
        <div className="bg-background rounded-md shadow-2xl border border-border overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <MagnifyingGlassIcon className="size-5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search projects, pages, files..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {loading && <Loader2 className="size-4 text-muted-foreground animate-spin shrink-0" />}
            <kbd className="hidden sm:inline-flex text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[320px] overflow-y-auto">
            {!query.trim() ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Type to search across your workspace
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Projects, pages, and files
                </p>
              </div>
            ) : results.length === 0 && !loading ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No results for &quot;{query}&quot;
                </p>
              </div>
            ) : (
              <div className="py-1">
                {(["project", "page", "file", "folder", "sticky"] as const).map((type) => {
                  const items = grouped[type];
                  if (!items?.length) return null;
                  return (
                    <div key={type}>
                      <div className="px-4 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                          {getLabel(type)}s
                        </span>
                      </div>
                      {items.map((item) => {
                        flatIndex++;
                        const idx = flatIndex;
                        return (
                          <button
                            key={`${item.type}-${item.id}`}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer ${
                              selectedIndex === idx
                                ? "bg-primary/5 text-primary"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            {getIcon(item)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{item.name}</p>
                              {item.type === "sticky" && item.content && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {item.content}
                                </p>
                              )}
                              {item.projectName && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  in {item.projectName}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground/40 shrink-0">
                              {getLabel(item.type)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground/50">
            <span>
              <kbd className="bg-muted px-1 py-0.5 rounded font-mono mr-1">↑↓</kbd>
              Navigate
            </span>
            <span>
              <kbd className="bg-muted px-1 py-0.5 rounded font-mono mr-1">↵</kbd>
              Open
            </span>
            <span>
              <kbd className="bg-muted px-1 py-0.5 rounded font-mono mr-1">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// Export a trigger button for the header
export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-primary/50 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
    >
      <MagnifyingGlassIcon className="size-4" />
      <span className="text-xs font-medium hidden sm:inline">Search</span>
      <kbd className="hidden sm:inline-flex text-[10px] bg-muted text-muted-foreground/50 px-1.5 py-0.5 rounded font-mono ml-1">
        ⌘K
      </kbd>
    </button>
  );
}
