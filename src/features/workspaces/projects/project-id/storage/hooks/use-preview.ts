import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getFileArrayBuffer, updateFileMetadata } from '@/features/workspaces/projects/project-id/storage/services/file.service';
import { previewServices } from '@/features/workspaces/projects/project-id/storage/services/preview.service';
import type { StorageItem } from '@/features/workspaces/projects/project-id/storage/types/storage.types';
import { resolveFileUrl } from '@/shared/utils/url';
import type { PdfMetadata, CrossrefWork } from '../types/preview.types';
import { mergeCrossrefMetadata } from '../utils/preview.utils';

export function usePreview(item: StorageItem | null) {
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [crossrefLoading, setCrossrefLoading] = useState(false);
  const [crossrefStatus, setCrossrefStatus] = useState<'idle' | 'found' | 'not-found' | 'error'>('idle');

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CrossrefWork[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // UI state
  const [saved, setSaved] = useState(false);
  const [abstractExpanded, setAbstractExpanded] = useState(false);

  const queryClient = useQueryClient();

  const saveMetadataMutation = useMutation({
    mutationFn: (args: { fileId: string; metaData: Record<string, any> }) => updateFileMetadata(args.fileId, args.metaData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-home-files'] });
      queryClient.invalidateQueries({ queryKey: ['my-files'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-my-files'] });
    }
  });

  const renderPdfPreview = useCallback(async (fileItem: StorageItem) => {
    const resolvedUrl = resolveFileUrl(fileItem.url);
    if (!resolvedUrl) return;
    try {
      const dataUrl = await previewServices.generatePreview(resolvedUrl);
      if (dataUrl) setPreviewDataUrl(dataUrl);
    } catch { 
      // ignore preview generation errors
    }
  }, []);

  const processNewPdf = useCallback(async (resolvedUrl: string, signal: { cancelled: boolean }) => {
    try {
      setLoading(true);
      const arrayBuffer = await getFileArrayBuffer(resolvedUrl);
      if (signal.cancelled) return;

      // Extract metadata (PDF.js transfers arrayBuffer to worker → detached after this)
      const { metadata: baseMeta, doi } = await previewServices.extractMetadata(arrayBuffer);
      if (signal.cancelled) return;
      setMetadata(baseMeta);

      // Generate preview with a fresh fetch — cannot reuse the detached arrayBuffer
      previewServices.generatePreview(resolvedUrl).then(dataUrl => {
        if (!signal.cancelled && dataUrl) {
          setPreviewDataUrl(dataUrl);
        }
      });

      // Enrich metadata via Crossref
      setCrossrefLoading(true);
      try {
        const { enrichedMeta, found } = await previewServices.enrichWithCrossref(baseMeta, doi);
        if (!signal.cancelled) {
          if (found) {
            setMetadata(enrichedMeta);
            setCrossrefStatus('found');
          } else {
            setCrossrefStatus('not-found');
          }
        }
      } catch {
        if (!signal.cancelled) setCrossrefStatus('error');
      } finally {
        if (!signal.cancelled) setCrossrefLoading(false);
      }
    } catch (err) {
      console.error('Failed to process PDF:', err);
      if (!signal.cancelled) {
        setMetadata(null);
        setPreviewDataUrl(null);
      }
    } finally {
      if (!signal.cancelled) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!item || !item.url) {
      setMetadata(null);
      setPreviewDataUrl(null);
      setCrossrefStatus('idle');
      return;
    }

    const isPdf = item.filename.toLowerCase().endsWith('.pdf') || item.mimeType === 'application/pdf';
    if (!isPdf) {
      setMetadata(null);
      setPreviewDataUrl(null);
      return;
    }

    // If we already have enriched metadata in the item, just use it directly
    if (item.metaData && Object.keys(item.metaData).length > 0) {
      setMetadata(item.metaData as PdfMetadata);
      setCrossrefStatus(item.metaData.crossrefEnriched ? 'found' : 'idle');
      renderPdfPreview(item);
      return;
    }

    // Otherwise, process from scratch
    setMetadata(null);
    setPreviewDataUrl(null);
    setCrossrefStatus('idle');

    const signal = { cancelled: false };
    const resolvedUrl = resolveFileUrl(item.url);
    if (resolvedUrl) {
      processNewPdf(resolvedUrl, signal);
    }

    return () => { signal.cancelled = true; };
  }, [item?.id, item?.url, renderPdfPreview, processNewPdf]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const result = await previewServices.getCrossrefSearch(searchQuery, 5);
      setSearchResults(result.works);
    } catch {
      toast.error('Failed to search Crossref');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectCrossref = (work: CrossrefWork) => {
    if (metadata) {
      setMetadata(mergeCrossrefMetadata(metadata, work));
      setCrossrefStatus('found');
      setSearchOpen(false);
      setSaved(false);
    }
  };

  const handleRetryLookup = async () => {
    if (!metadata) return;
    setCrossrefLoading(true);
    try {
      const { enrichedMeta, found } = await previewServices.enrichWithCrossref(metadata, metadata.doi);
      if (found) {
        setMetadata(enrichedMeta);
        setCrossrefStatus('found');
        setSaved(false);
      } else {
        setCrossrefStatus('not-found');
        toast.info('No results found on Crossref');
      }
    } catch {
      setCrossrefStatus('error');
      toast.error('Failed to reach Crossref API');
    } finally {
      setCrossrefLoading(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!item || !metadata) return;
    try {
      const finalMetadata = { ...metadata, crossrefEnriched: crossrefStatus === 'found' };
      await saveMetadataMutation.mutateAsync({ fileId: item.id, metaData: finalMetadata });
      setSaved(true);
      toast.success('Metadata saved successfully');
    } catch (error) {
      toast.error('Failed to save metadata');
      console.error(error);
    }
  };

  return {
    metadata, setMetadata,
    previewDataUrl,
    loading,
    crossrefLoading, crossrefStatus,
    searchOpen, setSearchOpen,
    searchQuery, setSearchQuery,
    searchResults,
    searchLoading,
    saved, setSaved,
    abstractExpanded, setAbstractExpanded,
    handleSearch, handleSelectCrossref, handleRetryLookup, handleSaveMetadata
  };
}
