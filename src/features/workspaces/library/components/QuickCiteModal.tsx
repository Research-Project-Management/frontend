'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Quote,
  Copy,
  Check,
  Download,
  FileCode,
  BookOpen,
  X,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import {
  convertToBibTeX,
  formatCiteCommand,
  formatApaCitation,
  formatIeeeCitation,
  getPaperCitationKey,
} from '../utils/library.util';
import type { Paper, CslStyle } from '../types/library.types';
import { ReferenceService } from '../services/reference.service';

interface QuickCiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  paper: Paper | null;
  selectedPapers?: Paper[];
  workspaceId: string;
}

type CitationTab = 'latex' | 'bibtex' | 'apa' | 'ieee' | 'nature' | 'chicago' | 'ris' | 'csljson';

export default function QuickCiteModal({
  isOpen,
  onClose,
  paper,
  selectedPapers = [],
  workspaceId,
}: QuickCiteModalProps) {
  const [activeTab, setActiveTab] = useState<CitationTab>('latex');
  const [copied, setCopied] = useState(false);
  const [cslFormatted, setCslFormatted] = useState<Record<string, string>>({});
  const [loadingCsl, setLoadingCsl] = useState(false);

  const isMulti = selectedPapers.length > 1;
  const targetPapers = isMulti ? selectedPapers : paper ? [paper] : [];
  const primaryPaper = targetPapers[0];

  // Fetch CSL formatting from backend when modal opens
  useEffect(() => {
    if (!isOpen || targetPapers.length === 0 || !workspaceId) return;

    let isMounted = true;
    const fetchCsl = async () => {
      setLoadingCsl(true);
      try {
        if (!isMulti && primaryPaper?.id) {
          const [apaRes, ieeeRes, natRes, chiRes] = await Promise.allSettled([
            ReferenceService.formatCitation(workspaceId, primaryPaper.id, 'apa'),
            ReferenceService.formatCitation(workspaceId, primaryPaper.id, 'ieee'),
            ReferenceService.formatCitation(workspaceId, primaryPaper.id, 'nature'),
            ReferenceService.formatCitation(workspaceId, primaryPaper.id, 'chicago'),
          ]);

          if (isMounted) {
            setCslFormatted({
              apa: apaRes.status === 'fulfilled' ? apaRes.value.bibliography : '',
              ieee: ieeeRes.status === 'fulfilled' ? ieeeRes.value.bibliography : '',
              nature: natRes.status === 'fulfilled' ? natRes.value.bibliography : '',
              chicago: chiRes.status === 'fulfilled' ? chiRes.value.bibliography : '',
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch remote CSL citation:', err);
      } finally {
        if (isMounted) setLoadingCsl(false);
      }
    };

    fetchCsl();
    return () => {
      isMounted = false;
    };
  }, [isOpen, primaryPaper?.id, isMulti, workspaceId, targetPapers.length]);

  if (!primaryPaper) return null;

  // Generate contents
  const latexCommand = isMulti
    ? `\\cite{${targetPapers.map((p) => getPaperCitationKey(p)).filter(Boolean).join(', ')}}`
    : formatCiteCommand(primaryPaper);

  const bibtexContent = targetPapers.map((p) => convertToBibTeX(p)).join('\n\n');

  const apaContent = isMulti
    ? targetPapers.map((p) => formatApaCitation(p)).join('\n\n')
    : cslFormatted.apa || formatApaCitation(primaryPaper);

  const ieeeContent = isMulti
    ? targetPapers.map((p, idx) => `[${idx + 1}] ${formatIeeeCitation(p)}`).join('\n\n')
    : cslFormatted.ieee || formatIeeeCitation(primaryPaper);

  const risContent = targetPapers
    .map((p) => {
      return `TY  - JOUR
TI  - ${p.title || 'Untitled'}
${p.authors?.map((a) => `AU  - ${a}`).join('\n') || 'AU  - Unknown'}
PY  - ${p.year || ''}
DO  - ${p.doi || ''}
JO  - ${p.journal || p.publisher || ''}
ER  - `;
    })
    .join('\n\n');

  const cslJsonContent = JSON.stringify(
    targetPapers.map((p) => ({
      id: getPaperCitationKey(p),
      type: 'article-journal',
      title: p.title || 'Untitled',
      author: (p.authors || []).map((name) => {
        const parts = name.split(',');
        return parts.length > 1
          ? { family: parts[0].trim(), given: parts[1].trim() }
          : { literal: name };
      }),
      issued: p.year ? { 'date-parts': [[p.year]] } : undefined,
      'container-title': p.journal || p.publisher,
      DOI: p.doi || undefined,
    })),
    null,
    2,
  );

  const getCurrentText = (): string => {
    switch (activeTab) {
      case 'latex':
        return latexCommand;
      case 'bibtex':
        return bibtexContent;
      case 'apa':
        return apaContent;
      case 'ieee':
        return ieeeContent;
      case 'nature':
        return cslFormatted.nature || apaContent;
      case 'chicago':
        return cslFormatted.chicago || apaContent;
      case 'ris':
        return risContent;
      case 'csljson':
        return cslJsonContent;
      default:
        return latexCommand;
    }
  };

  const handleCopy = () => {
    const text = getCurrentText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`Copied ${activeTab.toUpperCase()} citation to clipboard!`, {
      description: isMulti ? `Bundle of ${targetPapers.length} papers` : primaryPaper.title,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const isBib = activeTab === 'bibtex' || activeTab === 'latex';
    const content = isBib ? bibtexContent : activeTab === 'ris' ? risContent : cslJsonContent;
    const ext = isBib ? 'bib' : activeTab === 'ris' ? 'ris' : 'json';
    const mime = isBib ? 'text/plain' : activeTab === 'ris' ? 'text/plain' : 'application/json';

    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const name = isMulti
      ? `references-bundle-${targetPapers.length}.${ext}`
      : `${getPaperCitationKey(primaryPaper)}.${ext}`;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${name}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden border border-border/80 bg-background/98 backdrop-blur-xl shadow-2xl rounded-2xl">
        {/* Modal Header */}
        <div className="p-5 border-b border-border/60 bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Quote className="size-4" />
                </div>
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                  Quick Citation & Export
                </DialogTitle>
                {isMulti && (
                  <Badge variant="secondary" className="font-mono text-[11px] px-2">
                    {targetPapers.length} Papers Selected
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1 max-w-lg">
                {isMulti
                  ? `${primaryPaper.title} and ${targetPapers.length - 1} other papers`
                  : primaryPaper.title || 'Untitled Paper'}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-5 pt-4 pb-2 border-b border-border/40 bg-muted/5">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as CitationTab)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-4 sm:grid-cols-8 h-8 p-0.5 bg-muted/60 rounded-lg">
              <TabsTrigger value="latex" className="text-[11px] font-medium px-1.5 py-1">
                LaTeX
              </TabsTrigger>
              <TabsTrigger value="bibtex" className="text-[11px] font-medium px-1.5 py-1">
                BibTeX
              </TabsTrigger>
              <TabsTrigger value="apa" className="text-[11px] font-medium px-1.5 py-1">
                APA 7
              </TabsTrigger>
              <TabsTrigger value="ieee" className="text-[11px] font-medium px-1.5 py-1">
                IEEE
              </TabsTrigger>
              <TabsTrigger value="nature" className="text-[11px] font-medium px-1.5 py-1">
                Nature
              </TabsTrigger>
              <TabsTrigger value="chicago" className="text-[11px] font-medium px-1.5 py-1">
                Chicago
              </TabsTrigger>
              <TabsTrigger value="ris" className="text-[11px] font-medium px-1.5 py-1">
                RIS
              </TabsTrigger>
              <TabsTrigger value="csljson" className="text-[11px] font-medium px-1.5 py-1">
                JSON
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content Box */}
        <div className="p-5 space-y-4">
          <div className="relative group">
            <pre className="p-4 bg-muted/40 rounded-xl border border-border/60 font-mono text-xs text-foreground/90 overflow-x-auto max-h-64 whitespace-pre-wrap leading-relaxed select-all">
              {getCurrentText()}
            </pre>
          </div>

          {/* Quick Details Pill */}
          {!isMulti && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono bg-muted px-2 py-0.5 rounded text-foreground font-semibold">
                key: {getPaperCitationKey(primaryPaper)}
              </span>
              {primaryPaper.doi && (
                <a
                  href={`https://doi.org/${primaryPaper.doi}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <span>doi:{primaryPaper.doi}</span>
                  <ExternalLink className="size-3" />
                </a>
              )}
              {primaryPaper.year && <span>• {primaryPaper.year}</span>}
              {primaryPaper.journal && <span>• <i>{primaryPaper.journal}</i></span>}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-amber-500" />
            <span>Instant 1-Click Clipboard Bridge</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-8 px-3 text-xs gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="size-3.5 text-muted-foreground" />
              <span>Export File</span>
            </Button>

            <Button
              size="sm"
              onClick={handleCopy}
              className="h-8 px-4 text-xs font-medium gap-1.5 cursor-pointer bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-300 animate-in zoom-in-50" />
              ) : (
                <Copy className="size-3.5" />
              )}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Citation'}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
