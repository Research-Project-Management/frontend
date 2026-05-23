import { useState } from "react";
import {
  Search,
  FolderOpen,
  FileText,
  ExternalLink,
  Trash2,
  User,
  CalendarDays,
  Tag,
  BookOpen,
} from "lucide-react";
import { useParams } from "react-router";
import { useWorkspace } from "~/query/workspace";
import {
  useAllPapers,
  useCollections,
  useDeletePaper,
} from "~/query/library";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { API_URL } from "~/lib/api";
import type { Paper, Collection } from "~/types/library";
import { PaperTableRow } from "../components/PaperTableRow";
import { PaperDetailPanel } from "../components/PaperDetailPanel";

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LibraryHomePage() {
  const { workspaceId: workspaceUrl } = useParams();
  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id ?? "";

  const { data: papers, isLoading } = useAllPapers(workspaceId);
  const { data: collections } = useCollections(workspaceId);
  const deletePaperMutation = useDeletePaper(workspaceId, "");

  const [search, setSearch] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);

  const collectionMap = Object.fromEntries(
    (collections ?? []).map((c) => [c._id, c]),
  );

  const filtered = (papers ?? []).filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.authors.some((a) => a.toLowerCase().includes(search.toLowerCase())) ||
      (p.journal || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.abstract || "").toLowerCase().includes(search.toLowerCase()),
  );

  const selectedPaper = (papers ?? []).find((p) => p._id === selectedPaperId) || null;

  const handleDeletePaper = (paperId: string) => {
    if (!confirm("Remove this paper?")) return;
    deletePaperMutation.mutate(paperId);
    if (selectedPaperId === paperId) setSelectedPaperId(null);
  };

  const selectedCollection = selectedPaper?.collection
    ? collectionMap[selectedPaper.collection] ?? null
    : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-primary shrink-0" />
              <h1 className="text-sm font-semibold text-primary">
                All Papers
              </h1>
            </div>
            {papers && (
              <span className="ml-1 text-xs text-muted-foreground tabular-nums bg-muted/50 px-1.5 py-0.5 rounded">
                {papers.length} papers
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search title, author, journal, abstract…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-80 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center px-6">
              <p className="text-sm font-semibold text-foreground">
                {search ? "No papers match" : "No papers yet"}
              </p>
              <p className="text-xs text-muted-foreground">
                {search ? "Try a different keyword" : "Select a collection from the sidebar to add papers"}
              </p>
            </div>
          ) : (
            /* table-fixed + w-full forces columns to their set widths and clips overflow */
            <table className="w-full text-sm border-collapse table-fixed select-none">
              <colgroup>
                <col style={{ width: "56px" }} />
                <col />
                <col style={{ width: "200px" }} />
                <col style={{ width: "60px" }} />
                <col style={{ width: "150px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "60px" }} />
              </colgroup>
              <thead className="sticky top-0 z-10 select-none">
                <tr className="bg-zinc-50 border-b border-border/60">
                  <th style={{ width: "56px" }} className="py-3 pl-4 pr-1" />
                  <th className="text-left py-3 pr-4 text-[10px] font-bold uppercase tracking-wider text-[#5f6368]/90">
                    Title
                  </th>
                  <th className="text-left py-3 pr-4 text-[10px] font-bold uppercase tracking-wider text-[#5f6368]/90">
                    Authors
                  </th>
                  <th className="text-left py-3 pr-3 text-[10px] font-bold uppercase tracking-wider text-[#5f6368]/90">
                    Year
                  </th>
                  <th className="text-left py-3 pr-3 text-[10px] font-bold uppercase tracking-wider text-[#5f6368]/90">
                    Journal
                  </th>
                  <th className="text-left py-3 pr-3 text-[10px] font-bold uppercase tracking-wider text-[#5f6368]/90">
                    Collection
                  </th>
                  <th className="py-3 pr-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((paper) => (
                  <PaperTableRow
                    key={paper._id}
                    paper={paper}
                    collection={paper.collection ? collectionMap[paper.collection] ?? null : null}
                    onDelete={handleDeletePaper}
                    isSelected={selectedPaperId === paper._id}
                    onSelect={(p) => setSelectedPaperId(p._id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedPaper && (
        <PaperDetailPanel paper={selectedPaper} collection={selectedCollection} workspaceId={workspaceId} />
      )}
    </div>
  );
}
