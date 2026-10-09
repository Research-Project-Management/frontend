import React from 'react';
import {
  BookOpen,
  FileCode,
  FileText,
  GraduationCap,
  Layout,
  Scroll,
} from 'lucide-react';

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
