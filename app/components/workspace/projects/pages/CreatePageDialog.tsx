import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useCreatePage } from "~/query/page";
import { useProjects } from "~/hooks/useWorkspace";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Loader2,
  Plus,
  FileText,
  BookOpen,
  Presentation,
  FileCode2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

// ── LaTeX templates ──────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "blank",
    label: "Blank",
    icon: FileText,
    content: `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}

\\title{Untitled}
\\author{}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}


\\end{document}
`,
  },
  {
    id: "article",
    label: "Article",
    icon: BookOpen,
    content: `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amsfonts,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{geometry}
\\geometry{margin=2.5cm}

\\title{Article Title}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
  Your abstract goes here.
\\end{abstract}

\\section{Introduction}
\\label{sec:intro}

\\section{Methodology}
\\label{sec:method}

\\section{Results}
\\label{sec:results}

\\section{Conclusion}
\\label{sec:conclusion}

\\bibliographystyle{plain}

\\end{document}
`,
  },
  {
    id: "report",
    label: "Report",
    icon: FileCode2,
    content: `\\documentclass[12pt,a4paper]{report}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amsfonts,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{geometry}
\\geometry{margin=2.5cm}

\\title{Report Title}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle
\\tableofcontents
\\newpage

\\chapter{Introduction}

\\chapter{Background}

\\chapter{Methodology}

\\chapter{Results and Discussion}

\\chapter{Conclusion}

\\bibliographystyle{plain}

\\end{document}
`,
  },
  {
    id: "beamer",
    label: "Presentation",
    icon: Presentation,
    content: `\\documentclass{beamer}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amsfonts}
\\usepackage{graphicx}

\\usetheme{Madrid}
\\usecolortheme{default}

\\title{Presentation Title}
\\subtitle{Subtitle}
\\author{Author Name}
\\institute{Institution}
\\date{\\today}

\\begin{document}

\\begin{frame}
  \\titlepage
\\end{frame}

\\begin{frame}{Outline}
  \\tableofcontents
\\end{frame}

\\section{Introduction}

\\begin{frame}{Introduction}
  \\begin{itemize}
    \\item First point
    \\item Second point
    \\item Third point
  \\end{itemize}
\\end{frame}

\\section{Conclusion}

\\begin{frame}{Conclusion}
  \\begin{block}{Summary}
    Summary of the work.
  \\end{block}
\\end{frame}

\\end{document}
`,
  },
] as const;

type TemplateId = (typeof TEMPLATES)[number]["id"];

// ── Component ────────────────────────────────────────────────────────────────

export default function CreatePageDialog({
  defaultProjectId,
}: {
  defaultProjectId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    defaultProjectId ?? "",
  );
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("blank");

  const { projects, isLoading: isLoadingProjects } = useProjects();
  const createPageMutation = useCreatePage();
  const navigate = useNavigate();

  const handleCreate = () => {
    if (!title.trim() || !selectedProjectId) return;
    const template = TEMPLATES.find((t) => t.id === selectedTemplate);
    const content =
      template?.content
        .replace("Untitled", title.trim())
        .replace(/(\\title\{)([^}]*)/, `$1${title.trim()}`) ?? "";

    createPageMutation.mutate(
      {
        projectId: selectedProjectId,
        title: title.trim(),
        status: "draft",
        content,
      },
      {
        onSuccess: ({ mainFileId }) => {
          setOpen(false);
          setTitle("");
          if (!defaultProjectId) setSelectedProjectId("");
          setSelectedTemplate("blank");
          toast.success("Document created");
          if (mainFileId) navigate(`/editor/${mainFileId}`);
        },
        onError: (error: any) => {
          toast.error(error.message ?? "Failed to create document");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="shrink-0">
          <Plus className="size-4 mr-1.5" />
          New Document
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New document</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Template picker */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Template</Label>
            <div className="grid grid-cols-4 gap-2">
              {TEMPLATES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedTemplate(id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg border text-center transition-all text-xs",
                    selectedTemplate === id
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/40 text-muted-foreground",
                  )}
                >
                  {/* Mini paper preview */}
                  <div
                    className={cn(
                      "w-full aspect-3/4 rounded border flex items-center justify-center",
                      selectedTemplate === id
                        ? "bg-primary/10 border-primary/30"
                        : "bg-muted/40 border-border",
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              placeholder="Untitled document"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              autoFocus
            />
          </div>

          {/* Project */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-project">Project</Label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              disabled={!!defaultProjectId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoadingProjects ? "Loading…" : "Select a project"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project: any) => (
                  <SelectItem key={project._id} value={project._id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              !title.trim() ||
              !selectedProjectId ||
              createPageMutation.isPending
            }
          >
            {createPageMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
