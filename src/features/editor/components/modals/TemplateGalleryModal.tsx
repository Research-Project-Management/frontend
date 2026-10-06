'use client';

import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  FileCode,
  FileText,
  GraduationCap,
  Layout,
  Scroll,
  Sparkles,
  X,
  FileCheck,
  Search,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useSettingsStore, usePageStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { manuscriptService } from '@/features/editor/services/manuscript.service';


export interface AcademicTemplate {
  id: string;
  name: string;
  category: 'Conference' | 'Journal' | 'Preprint' | 'Thesis' | 'Resume';
  publisher: string;
  description: string;
  icon: React.ElementType;
  badge: string;
  mainTex: string;
  bibTex?: string;
}

export const ACADEMIC_TEMPLATES: AcademicTemplate[] = [
  {
    id: 'ieee-conference',
    name: 'IEEE Conference Paper (2-Column)',
    category: 'Conference',
    publisher: 'IEEE',
    description: 'Standard IEEE 2-column format for conference proceedings, symposiums, and technical workshops.',
    icon: Layout,
    badge: 'IEEEtran',
    mainTex: `\\documentclass[conference]{IEEEtran}
\\usepackage{cite}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{algorithmic}
\\usepackage{graphicx}
\\usepackage{textcomp}
\\usepackage{xcolor}

\\begin{document}

\\title{Conference Paper Title*\\\\
{\\footnotesize \\textsuperscript{*}Note: Sub-title as needed}}

\\author{\\IEEEauthorblockN{First Author}
\\IEEEauthorblockA{\\textit{Dept. of Computer Science} \\\\
\\textit{Flux Research Lab}\\\\
Hanoi, Vietnam \\\\
author@flux.org}
}

\\maketitle

\\begin{abstract}
This document provides guidelines for preparing IEEE conference papers using LaTeX. The abstract should summarize the primary research problem, methodology, and key quantitative findings.
\\end{abstract}

\\begin{IEEEkeywords}
machine learning, distributed systems, research collaboration
\\end{IEEEkeywords}

\\section{Introduction}
Welcome to your new research manuscript on Flux. This template adheres to the IEEE conference publishing guidelines. Collaborative authoring is supported natively in real-time.

\\section{Related Work}
Prior investigations have explored Overleaf-like collaborative editing platforms \\cite{vaswani2017attention}.

\\section{Methodology}
Detail your scientific methodology, formulas, and experimental setup here:
\\begin{equation}
  \\mathcal{L}(\\theta) = -\\sum_{i=1}^{N} y_i \\log \\hat{y}_i + (1 - y_i) \\log(1 - \\hat{y}_i)
\\end{equation}

\\section{Conclusion}
Summarize the primary contributions and future outlook of this work.

\\bibliographystyle{IEEEtran}
\\bibliography{references}

\\end{document}`,
    bibTex: `@article{vaswani2017attention,
  title={Attention is all you need},
  author={Vaswani, Ashish and Shazeer, Noam and Parmar, Niki and Uszkoreit, Jakob and Jones, Llion and Gomez, Aidan N and Kaiser, {\\L}ukasz and Polosukhin, Illia},
  journal={Advances in neural information processing systems},
  volume={30},
  year={2017}
}`,
  },
  {
    id: 'acm-sigconf',
    name: 'ACM Master Article (SIGCONF)',
    category: 'Conference',
    publisher: 'ACM',
    description: 'ACM Primary Article Template for SIGGRAPH, CHI, KDD, and international ACM conference proceedings.',
    icon: BookOpen,
    badge: 'acmart',
    mainTex: `\\documentclass[sigconf]{acmart}

\\AtBeginDocument{%
  \\providecommand\\BibTeX{{%
    Bib\\TeX}}}

\\setcopyright{acmlicensed}
\\copyrightyear{2026}
\\acmYear{2026}
\\acmConference[FLUX '26]{Flux Academic Computing Conference}{September 2026}{Hanoi, Vietnam}

\\begin{document}

\\title{A Modern Collaborative Academic Workbench for Scientific Writing}

\\author{Flux Research Team}
\\affiliation{%
  \\institution{Flux Research Lab}
  \\city{Hanoi}
  \\country{Vietnam}
}
\\email{research@flux.org}

\\begin{abstract}
We present a unified academic platform designed for modern scientific collaboration, combining rich LaTeX typesetting with native reference management and AI copilot capabilities.
\\end{abstract}

\\keywords{LaTeX, Collaboration, Academic SaaS, Reference Management}

\\maketitle

\\section{Introduction}
Scientific manuscripts demand uncompromising precision in typesetting, citation correctness, and mathematical formulations.

\\section{Architecture}
Our system features an 8-level architecture encompassing compilers, real-time sync, and intelligent literature search.

\\bibliographystyle{ACM-Reference-Format}
\\bibliography{references}

\\end{document}`,
    bibTex: `@inproceedings{flux2026workbench,
  title={A Modern Collaborative Academic Workbench for Scientific Writing},
  author={Flux Team},
  booktitle={ACM Conference on Scientific Systems},
  year={2026}
}`,
  },
  {
    id: 'springer-lncs',
    name: 'Springer LNCS (Computer Science)',
    category: 'Conference',
    publisher: 'Springer',
    description: 'Lecture Notes in Computer Science proceedings, CCIS, and Springer Nature conference series.',
    icon: Scroll,
    badge: 'llncs',
    mainTex: `\\documentclass[runningheads]{llncs}
\\usepackage{graphicx}
\\usepackage{amsmath}

\\begin{document}

\\title{Contribution Title\\thanks{Supported by Flux Science Foundation.}}
\\titlerunning{Abbreviated Paper Title}

\\author{First Author\\inst{1}\\orcidID{0000-1111-2222-3333} \\and
Second Author\\inst{2,3}\\orcidID{1111-2222-3333-4444}}

\\authorrunning{F. Author and S. Author}

\\institute{Flux Research Institute, Hanoi, Vietnam
\\email{\\{author1,author2\\}@flux.org}}

\\maketitle

\\begin{abstract}
The abstract should briefly state the problem, the proposed solution, and summarize empirical validation on benchmark datasets.

\\keywords{First keyword \\and Second keyword \\and Scientific Benchmarks.}
\\end{abstract}

\\section{Introduction}
The Springer LNCS series covers important advances in computer science and information technology.

\\section{Experimental Results}
Quantitative results demonstrate rigorous validation across multiple trials.

\\begin{thebibliography}{8}
\\bibitem{ref_article1}
Author, F.: Article title. Journal \\textbf{2}(5), 99--110 (2025)
\\end{thebibliography}

\\end{document}`,
  },
  {
    id: 'arxiv-preprint',
    name: 'arXiv Preprint (Single Column)',
    category: 'Preprint',
    publisher: 'arXiv',
    description: 'Clean, elegant, modern preprint layout for arXiv, bioRxiv, and peer review submissions.',
    icon: FileCode,
    badge: 'article',
    mainTex: `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{hyperref}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage[margin=1in]{geometry}
\\usepackage{microtype}

\\title{\\textbf{High-Fidelity Document Synthesis and Real-Time Peer Review}}
\\author{
  \\textbf{Flux Research Group} \\\\
  Department of Computer Science \\\\
  \\texttt{contact@flux.org}
}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
Scientific progress relies heavily on reproducible and accessible dissemination. We formulate an end-to-end framework enabling researchers to compose, verify, and typeset academic papers seamlessly.
\\end{abstract}

\\section{Introduction}
Modern scientific collaboration requires instant synchronization across heterogeneous devices while preserving strict TeX Live compatibility.

\\section{Formulation}
Consider a distributed document state $\\mathcal{D} = \\{ t_1, t_2, \\dots, t_n \\}$ subjected to concurrent edits.

\\section{Discussion}
We evaluate the latency and throughput of incremental compilation engines.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}`,
  },
  {
    id: 'thesis-dissertation',
    name: 'Academic Thesis / Dissertation',
    category: 'Thesis',
    publisher: 'University',
    description: 'Comprehensive chapter-based thesis structure with title page, abstract, table of contents, and chapters.',
    icon: GraduationCap,
    badge: 'report',
    mainTex: `\\documentclass[12pt,oneside]{report}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage[margin=1.2in]{geometry}
\\usepackage{setspace}
\\onehalfspacing

\\begin{document}

\\begin{titlepage}
\\centering
{\\scshape\\LARGE National Research University \\par}
\\vspace{1.5cm}
{\\scshape\\Large Master's Dissertation \\par}
\\vspace{1.5cm}
{\\huge\\bfseries Collaborative Architectures for Next-Generation Scientific Computing \\par}
\\vspace{2cm}
{\\Large\\itshape Candidate: Flux Scholar \\par}
\\vfill
supervised by\\par
Prof.~Academic Advisor

\\vfill
{\\large \\today \\par}
\\end{titlepage}

\\tableofcontents

\\chapter{Introduction}
\\section{Context and Motivation}
Scientific knowledge discovery increasingly involves multi-institutional consortia working across geographical boundaries.

\\chapter{Literature Review}
\\section{Foundational Works}
Discussion of state-of-the-art collaborative editing systems and typesetting engines.

\\chapter{Methodology and System Architecture}
Detailed design of the multi-level synchronization pipeline.

\\chapter{Conclusion and Future Work}
Summary of key results and open problems for subsequent research.

\\end{document}`,
  },
  {
    id: 'academic-cv',
    name: 'Academic Curriculum Vitae (CV)',
    category: 'Resume',
    publisher: 'Academic',
    description: 'Professional LaTeX CV highlighting education, research publications, grants, and teaching experience.',
    icon: FileText,
    badge: 'curriculum vitae',
    mainTex: `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.8in]{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}

\\pagestyle{empty}
\\setlength{\\parindent}{0pt}

\\begin{document}

{\\LARGE \\textbf{Dr. Academic Researcher, Ph.D.}}\\\\
\\rule{\\textwidth}{1pt}
\\vspace{0.2cm}
Flux Research Institute · Hanoi, Vietnam · \\href{mailto:scholar@flux.org}{scholar@flux.org} · \\href{https://flux.org}{flux.org}

\\vspace{0.4cm}
\\textbf{\\large EDUCATION}
\\vspace{0.2cm}

\\textbf{Ph.D. in Computer Science} \\hfill 2020 -- 2024\\\\
National University of Science \\hfill Hanoi, Vietnam\\\\
Dissertation: \\textit{Distributed Consensus Protocols for Real-Time Scientific Collaboration}

\\vspace{0.2cm}
\\textbf{B.S. in Software Engineering}, Summa Cum Laude \\hfill 2016 -- 2020\\\\
University of Technology

\\vspace{0.4cm}
\\textbf{\\large SELECTED PUBLICATIONS}
\\vspace{0.2cm}

\\begin{itemize}[leftmargin=1.5em,noitemsep]
  \\item \\textbf{Researcher, A.}, et al. \`\`High-Precision LaTeX Compilation in Cloud Sandboxes.'' \\textit{ACM SIGCONF}, 2026.
  \\item \\textbf{Researcher, A.}, et al. \`\`Real-Time Operational Transformation for Academic Manuscripts.'' \\textit{IEEE Trans. Software Eng.}, 2025.
\\end{itemize}

\\vspace{0.4cm}
\\textbf{\\large AWARDS \\& HONORS}
\\vspace{0.2cm}

\\begin{itemize}[leftmargin=1.5em,noitemsep]
  \\item Best Paper Award, International Computing Symposium, 2025.
  \\item National Research Fellowship Award, 2023.
\\end{itemize}

\\end{document}`,
  },
];

export default function TemplateGalleryModal() {
  const { isTemplateModalOpen, setIsTemplateModalOpen } = useSettingsStore();
  const { activeFilePage, projectId } = usePageStore();
  const { engine } = useEditorInstance();
  const [selectedTemplate, setSelectedTemplate] = useState<AcademicTemplate>(ACADEMIC_TEMPLATES[0]);
  const [previewTab, setPreviewTab] = useState<'main' | 'bib'>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Query dynamic backend manuscript templates
  const { data: serverTemplates = [], isLoading: isLoadingServer } = useQuery({
    queryKey: ['manuscript-templates', categoryFilter, searchQuery],
    queryFn: async () => {
      try {
        const res = await manuscriptService.templates.list({
          category: categoryFilter === 'All' ? undefined : categoryFilter,
          search: searchQuery || undefined,
        });
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
    enabled: isTemplateModalOpen,
  });

  const combinedTemplates = useMemo(() => {
    const list: AcademicTemplate[] = [...ACADEMIC_TEMPLATES];
    serverTemplates.forEach((st) => {
      if (!list.some((t) => t.id === st.id)) {
        list.push({
          id: st.id,
          name: st.name,
          category: (st.category as any) || 'Conference',
          publisher: st.publisher || 'Manuscripts',
          description: st.description || 'Verified academic template from backend repository',
          icon: Layout,
          badge: st.badge || 'latex',
          mainTex: `% Template: ${st.name}\n\\documentclass{article}\n\\begin{document}\n\\title{${st.name}}\n\\maketitle\n\n\\section{Introduction}\nDocument initialized from template.\n\\end{document}`,
        });
      }
    });
    return list.filter((tpl) => {
      const matchCat =
        categoryFilter === 'All' || tpl.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchQuery =
        !searchQuery ||
        tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [serverTemplates, categoryFilter, searchQuery]);

  const handleSelectTemplate = async (tpl: AcademicTemplate) => {
    setSelectedTemplate(tpl);
    setPreviewTab('main');
    // If it's a server template, dynamically fetch latest template payload
    if (!ACADEMIC_TEMPLATES.some((a) => a.id === tpl.id)) {
      try {
        const remoteDetails = await manuscriptService.templates.getById(tpl.id);
        if (remoteDetails?.mainTex || remoteDetails?.content) {
          setSelectedTemplate((prev) => ({
            ...prev,
            mainTex: remoteDetails.mainTex || remoteDetails.content || prev.mainTex,
            bibTex: remoteDetails.bibTex || prev.bibTex,
          }));
        }
      } catch {
        // use fallback mainTex
      }
    }
  };

  const [isScaffolding, setIsScaffolding] = useState(false);

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      if (engine) {
        engine.setContent(selectedTemplate.mainTex);
        toast.success(`Applied "${selectedTemplate.name}" to ${activeFilePage?.title || 'current document'}`);
        setIsTemplateModalOpen(false);
      } else {
        navigator.clipboard.writeText(selectedTemplate.mainTex);
        toast.success(`Copied "${selectedTemplate.name}" template code to clipboard`);
        setIsTemplateModalOpen(false);
      }
    } catch {
      toast.error('Could not apply template');
    }
  };

  const handleScaffoldProject = async () => {
    if (!selectedTemplate) return;
    if (!projectId) {
      handleApplyTemplate();
      return;
    }
    setIsScaffolding(true);
    try {
      await manuscriptService.templates.scaffold(projectId, selectedTemplate.id);
      toast.success(`Project scaffolded successfully with "${selectedTemplate.name}"!`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
      }
      setIsTemplateModalOpen(false);
    } catch (err) {
      console.warn('[TemplateGallery] Backend scaffolding failed, falling back to active file update:', err);
      handleApplyTemplate();
    } finally {
      setIsScaffolding(false);
    }
  };

  const handleCopyCode = () => {
    const code = previewTab === 'bib' && selectedTemplate.bibTex
      ? selectedTemplate.bibTex
      : selectedTemplate.mainTex;
    navigator.clipboard.writeText(code);
    toast.success('Template code copied to clipboard');
  };

  return (
    <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-300 rounded-lg text-foreground select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
          <div>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Academic Templates & Starters
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Production-ready LaTeX paper templates matching official IEEE, ACM, Springer, and arXiv formats.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => setIsTemplateModalOpen(false)}
            className="size-7 rounded-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex flex-col md:flex-row h-[520px] divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
          {/* Left Column: Search & Template List (~340px) */}
          <div className="w-full md:w-84 flex flex-col bg-muted/10 shrink-0 overflow-hidden border-r border-border">
            {/* Search Input */}
            <div className="p-2.5 border-b border-border bg-background/50">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Template List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoadingServer && combinedTemplates.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-xs gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Loading templates...
                </div>
              ) : combinedTemplates.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No templates found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                combinedTemplates.map((tpl) => {
                  const isSelected = selectedTemplate.id === tpl.id;
                  const IconComp = tpl.icon || Layout;
                  return (
                    <div
                      key={tpl.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectTemplate(tpl)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectTemplate(tpl);
                        }
                      }}
                      className={cn(
                        'p-3 rounded-md border transition-all cursor-pointer text-left outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        isSelected
                          ? 'bg-primary/10 border-primary'
                          : 'border-border/60 hover:border-border hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn(
                            'size-6 rounded-sm flex items-center justify-center shrink-0',
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            <IconComp className="size-3.5" />
                          </div>
                          <span className="text-xs font-semibold text-foreground truncate">
                            {tpl.name}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-10 px-1 py-0 font-mono shrink-0 rounded-sm">
                          {tpl.badge}
                        </Badge>
                      </div>
                      <p className="text-11 text-muted-foreground line-clamp-2 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>


          {/* Right Column: Preview & Apply Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
            {/* Template Header & Switcher */}
            <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2 min-w-0">
                <Badge className="bg-primary text-primary-foreground text-10 font-semibold rounded-sm">
                  {selectedTemplate.publisher}
                </Badge>
                <span className="text-xs font-semibold text-foreground truncate">
                  {selectedTemplate.name}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-md bg-muted p-0.5 border border-border text-11">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('main')}
                    className={cn(
                      'px-2 py-0.5 rounded-sm text-11 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      previewTab === 'main'
                        ? 'bg-background text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    main.tex
                  </button>
                  {selectedTemplate.bibTex && (
                    <button
                      type="button"
                      onClick={() => setPreviewTab('bib')}
                      className={cn(
                        'px-2 py-0.5 rounded-sm text-11 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        previewTab === 'bib'
                          ? 'bg-background text-foreground font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      references.bib
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Copy code"
                  className="size-7 rounded-md flex items-center justify-center border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Code Preview Box */}
            <div className="flex-1 overflow-auto p-4 bg-muted/5 font-mono text-xs text-foreground/90 leading-relaxed whitespace-pre select-text">
              {previewTab === 'bib' && selectedTemplate.bibTex
                ? selectedTemplate.bibTex
                : selectedTemplate.mainTex}
            </div>

            {/* Bottom Action Footer */}
            <div className="px-5 py-3 border-t border-border bg-background flex items-center justify-between">
              <span className="text-11 text-muted-foreground">
                Apply template into active document or scaffold complete project files.
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="h-8 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyTemplate}
                  disabled={isScaffolding}
                  className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
                  title="Insert template code into current active file"
                >
                  <FileText className="size-3.5" />
                  <span>Insert into file</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleScaffoldProject}
                  disabled={isScaffolding}
                  className="h-8 gap-1.5 px-4 text-xs font-medium cursor-pointer"
                  title="Scaffold complete multi-file project with .bib, style files, and assets"
                >
                  {isScaffolding ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <FileCheck className="size-3.5" />
                  )}
                  <span>{isScaffolding ? 'Scaffolding...' : 'Scaffold Project'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
