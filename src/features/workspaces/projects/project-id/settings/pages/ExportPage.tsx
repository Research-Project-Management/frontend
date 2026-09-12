'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, FileText, BookOpen, Clock, Copy, Check, FileDown, Layers } from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { toast } from 'sonner';

export default function ExportPage() {
  const params = useParams();
  const [citationFormat, setCitationFormat] = useState<'ieee' | 'apa' | 'acm' | 'nature'>('ieee');
  const [copiedBib, setCopiedBib] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const sampleBibtex = `@article{flux2026research,
  title = {A Unified Research Management Platform with Virtual Assistant Integration},
  author = {Nguyen, Van A and Tran, Van B},
  journal = {IEEE Transactions on Knowledge and Data Engineering},
  year = {2026},
  volume = {38},
  number = {4},
  pages = {120--135}
}`;

  const handleCopyBibtex = () => {
    navigator.clipboard.writeText(sampleBibtex);
    setCopiedBib(true);
    toast.success('BibTeX copied to clipboard');
    setTimeout(() => setCopiedBib(false), 2000);
  };

  const handleDownloadBibtex = () => {
    const blob = new Blob([sampleBibtex], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-references-${citationFormat}.bib`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded references.bib');
  };

  const handleExportReport = (reportType: string, extension: string) => {
    setIsExporting(reportType);
    setTimeout(() => {
      setIsExporting(null);
      const content = `# Project Summary & Progress Report\nGenerated: ${new Date().toLocaleDateString()}\nProject: ${params?.projectId || 'Project'}\nFormat: ${reportType}`;
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-report.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${reportType} report`);
    }, 600);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Export & Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Export literature citations (BibTeX) for LaTeX/Overleaf, project progress summaries, and evaluation records.
          </p>
        </div>
      </div>

      {/* ── Section 1: Literature & Citations (BibTeX) ── */}
      <div className="rounded-md border border-border bg-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="size-4 text-foreground shrink-0" />
              Scientific Citations & Bibliography
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Export cataloged literature references for manuscripts and Overleaf papers.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-muted p-1 rounded-md">
            {([
              { id: 'ieee', label: 'IEEE' },
              { id: 'apa', label: 'APA' },
              { id: 'acm', label: 'ACM' },
              { id: 'nature', label: 'Nature' },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCitationFormat(id)}
                className={`px-2.5 py-1 text-11 font-medium rounded-sm transition-colors cursor-pointer ${
                  citationFormat === id
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* BibTeX Code Preview Box */}
        <div className="relative rounded-md border border-border bg-muted/40 p-3.5 font-mono text-12 text-foreground/90 overflow-x-auto">
          <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyBibtex}
              className="inline-flex items-center gap-1 h-7 px-2 text-11 font-sans rounded bg-background border border-border hover:bg-muted text-foreground transition-colors cursor-pointer"
            >
              {copiedBib ? <Check className="size-3 text-primary shrink-0" /> : <Copy className="size-3 shrink-0" />}
              <span>{copiedBib ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadBibtex}
              className="inline-flex items-center gap-1 h-7 px-2 text-11 font-sans rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="size-3 shrink-0" />
              <span>.bib</span>
            </button>
          </div>
          <pre className="pr-20 whitespace-pre leading-relaxed">{sampleBibtex}</pre>
        </div>
      </div>

      {/* ── Section 2: Defense & Progress Reports ── */}
      <div className="rounded-md border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="size-4 text-foreground shrink-0" />
            Project Reports & Defense Records
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Download consolidated documents for university research committees and milestone audits.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {[
            {
              id: 'progress',
              title: 'Progress Milestone Report',
              desc: 'Completed work items, research cycles progress, and deliverables.',
              ext: 'md',
              icon: Layers,
            },
            {
              id: 'timesheet',
              title: 'Contributor Effort Timesheet',
              desc: 'Detailed log of hours contributed by each researcher and supervisor.',
              ext: 'csv',
              icon: Clock,
            },
            {
              id: 'full-dossier',
              title: 'Executive Research Dossier',
              desc: 'Comprehensive project summary, methodology notes, and publications.',
              ext: 'json',
              icon: FileDown,
            },
          ].map((item) => {
            const Icon = item.icon;
            const isLoading = isExporting === item.id;
            return (
              <div
                key={item.id}
                className="flex flex-col justify-between p-4 rounded-md border border-border bg-background space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Icon className="size-4 text-foreground shrink-0" />
                    <span className="text-11 font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      .{item.ext}
                    </span>
                  </div>
                  <h3 className="text-13 font-semibold text-foreground">{item.title}</h3>
                  <p className="text-11 text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportReport(item.id, item.ext)}
                  disabled={isLoading}
                  className="w-full h-8 text-xs font-medium cursor-pointer"
                >
                  <Download className="mr-1.5 size-3.5 shrink-0" />
                  {isLoading ? 'Exporting...' : 'Export'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}