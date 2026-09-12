'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Download, FileText, Clock, FileDown, Layers } from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from '@/shared/lib/token-storage';

export default function ExportPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || '';
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExportReport = async (reportType: string, extension: string) => {
    setIsExporting(reportType);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (extension === 'csv' || extension === 'json') {
        const res = await fetch(
          `${API_BASE_URL}/api/projects/${projectId}/work-items/export?format=${extension}`,
          { headers },
        );
        if (!res.ok) {
          throw new Error(`Export failed with status ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project-${reportType}-${new Date().toISOString().slice(0, 10)}.${extension}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${reportType}.${extension}`);
      } else if (extension === 'md') {
        const [projRes, countsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/project/${projectId}`, { headers })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch(`${API_BASE_URL}/api/projects/${projectId}/states/counts`, { headers })
            .then((r) => (r.ok ? r.json() : {}))
            .catch(() => ({})),
        ]);

        const p = (projRes as any)?.project || projRes || {};
        const counts = countsRes || {};
        const totalItems = Object.values(counts).reduce(
          (acc: number, c: any) => acc + (typeof c === 'number' ? c : 0),
          0,
        );

        const content = [
          `# ${p.name || 'Project'} - Progress Milestone Report`,
          `**Identifier**: ${p.identifier || 'N/A'}`,
          `**Generated**: ${new Date().toLocaleString()}`,
          `**Description**: ${p.description || 'No description provided'}`,
          '',
          '## Work Items by State',
          ...Object.entries(counts).map(([state, count]) => `- **${state}**: ${count} items`),
          `- **Total Work Items**: ${totalItems}`,
          '',
          '## Cycles & Modules',
          `- **Active Modules**: ${(p.modules || []).join(', ') || 'tasks'}`,
          `- **Default Duration**: ${p.settings?.cycles?.defaultDurationDays || 14} days`,
          '',
          '---',
          '*Generated automatically by Flux Research Platform*',
        ].join('\n');

        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project-progress-report-${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exported Progress Milestone Report (.md)');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export report');
    } finally {
      setIsExporting(null);
    }
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
            Export project work items, progress milestone summaries, and raw dataset dossiers.
          </p>
        </div>
      </div>

      {/* ── Project Reports & Work Items Export ── */}
      <div className="rounded-md border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="size-4 text-foreground shrink-0" />
            Project Reports & Work Items
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