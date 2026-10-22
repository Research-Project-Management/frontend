'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getItemFileUrl } from '@/features/library/domain/item-url';
import { downloadAnnotatedPdf, UploadService } from '@/features/library/sdk/library.client';
import {
  useAttachments,
  useRenameAttachment,
} from '@/features/library/sdk/queries/extraction.queries';
import type {
  Item,
  ItemAttachment,
} from '@/features/library/domain/types/library.types';

export interface UseAttachmentCoordinatorParams {
  item: Item;
  scopeId?: string;
  onRegisterAdd?: (trigger: () => void) => void;
}

export type AttachmentLike = Omit<ItemAttachment, 'attachmentType'> & {
  attachmentType?: ItemAttachment['attachmentType'] | 'web_snapshot';
  type?: string;
  name?: string;
  fileUrl?: string;
};

const EMPTY_ATTACHMENTS: ItemAttachment[] = [];

/**
 * useAttachmentCoordinator
 *
 * Coordinator Pattern for Inspector Attachments.
 * Centralizes all attachment flows:
 * 1. File Upload (multipart S3/MinIO upload & attachment record creation).
 * 2. Link Attachments (URI-list validation and creation).
 * 3. Primary Attachment toggling.
 * 4. Web Snapshot capture trigger.
 * 5. Annotated PDF client-side download trigger.
 * 6. Attachment renaming & removal mutations.
 * 7. Reader route navigation.
 */
export function useAttachmentCoordinator({
  item: paper,
  scopeId,
  onRegisterAdd,
}: UseAttachmentCoordinatorParams) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get('q');
  const qParam = currentQuery ? `?q=${encodeURIComponent(currentQuery)}` : '';
  const routeProjectId = typeof params?.projectId === 'string' ? params.projectId : undefined;
  const rawScopeId = scopeId || paper.projectId || routeProjectId || 'user';

  const {
    captureSnapshot,
    isCapturingSnapshot,
    setPrimary,
    isSettingPrimary,
    add: addAttachment,
  } = useAttachments(rawScopeId, paper.id || '');

  const [isDownloadingAnnotated, setIsDownloadingAnnotated] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTitleInput, setLinkTitleInput] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameAttachmentMutation = useRenameAttachment(rawScopeId);

  useEffect(() => {
    if (onRegisterAdd) {
      onRegisterAdd(() => {
        fileInputRef.current?.click();
      });
    }
  }, [onRegisterAdd]);

  // File Upload Workflow
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !paper.id) return;
      try {
        setIsUploadingFile(true);
        const uploaded = await UploadService.uploadMultipart(rawScopeId, file);
        await addAttachment({
          itemId: paper.id,
          filename: uploaded.filename,
          url: uploaded.url,
          size: uploaded.size,
          mimeType: uploaded.mimeType,
          linkMode: 'imported_file',
          attachmentType: 'supplementary',
        });
      } catch (err: unknown) {
        toast.error('Failed to attach file', {
          description: err instanceof Error ? err.message : 'Please try again.',
        });
      } finally {
        setIsUploadingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [paper.id, rawScopeId, addAttachment],
  );

  // Link Attachment Workflow
  const handleOpenLinkForm = useCallback(() => {
    setLinkUrlInput('');
    setLinkTitleInput('');
    setIsAddingLink(true);
  }, []);

  const handleCancelLink = useCallback(() => {
    setIsAddingLink(false);
    setLinkUrlInput('');
    setLinkTitleInput('');
  }, []);

  const handleSubmitLinkAttachment = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!paper.id) return;
      const targetUrl = linkUrlInput.trim();
      if (!targetUrl) return;
      const linkTitle = linkTitleInput.trim() || targetUrl;

      try {
        setIsSubmittingLink(true);
        await addAttachment({
          itemId: paper.id,
          filename: linkTitle,
          url: targetUrl,
          size: 0,
          mimeType: 'text/uri-list',
          linkMode: 'linked_url',
          attachmentType: 'other',
        });
        setIsAddingLink(false);
        setLinkUrlInput('');
        setLinkTitleInput('');
      } catch (err: unknown) {
        toast.error('Failed to attach link', {
          description: err instanceof Error ? err.message : 'Please check the URL and try again.',
        });
      } finally {
        setIsSubmittingLink(false);
      }
    },
    [paper.id, linkUrlInput, linkTitleInput, addAttachment],
  );

  // Computed Attachment Buckets
  const rawAttachments = paper.attachments || EMPTY_ATTACHMENTS;
  const paperUrl = getItemFileUrl(paper);
  const paperFilename = paper.filename;

  const primaryAttachment = useMemo(() => {
    return (
      (rawAttachments as AttachmentLike[]).find(
        (att) =>
          att.attachmentType === 'primary_pdf' ||
          att.type === 'primary_pdf' ||
          (paperFilename && (att.filename === paperFilename || att.name === paperFilename)),
      ) || null
    );
  }, [rawAttachments, paperFilename]);

  const otherAttachments = useMemo(() => {
    return (rawAttachments as AttachmentLike[]).filter((att) => {
      if (att.attachmentType === 'primary_pdf' || att.type === 'primary_pdf') return false;
      if (paperFilename && (att.filename === paperFilename || att.name === paperFilename)) return false;
      return true;
    });
  }, [rawAttachments, paperFilename]);

  const hasSnapshot = useMemo(() => {
    return (rawAttachments as AttachmentLike[]).some(
      (att) =>
        att.linkMode === 'imported_url' ||
        att.attachmentType === 'snapshot' ||
        att.attachmentType === 'web_snapshot' ||
        att.mimeType === 'text/html' ||
        att.filename?.toLowerCase().endsWith('.html'),
    );
  }, [rawAttachments]);

  const handleOpenReader = useCallback(() => {
    if (!paper.id) return;
    router.push(`/library/papers/${paper.id}${qParam}`);
  }, [paper.id, router, qParam]);

  const handleDownload = useCallback((url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleDownloadAnnotatedPdf = useCallback(async () => {
    if (!paper.id) return;
    try {
      setIsDownloadingAnnotated(true);
      await downloadAnnotatedPdf(
        rawScopeId,
        paper.id,
        `${paper.title || 'document'}-annotated.pdf`,
      );
      toast.success('Annotated PDF downloaded', { id: 'annotated-pdf-download' });
    } catch (err: unknown) {
      toast.error('Failed to export annotated PDF', {
        description: err instanceof Error ? err.message : 'Please verify that annotations exist or try again.',
        id: 'annotated-pdf-download',
      });
    } finally {
      setIsDownloadingAnnotated(false);
    }
  }, [paper.id, paper.title, rawScopeId]);

  const handleSetPrimary = useCallback(
    async (attachmentId: string) => {
      if (!paper.id || !attachmentId) return;
      try {
        await setPrimary(attachmentId);
      } catch {
        // Notification handled inside useAttachments
      }
    },
    [paper.id, setPrimary],
  );

  const handleCaptureSnapshot = useCallback(async () => {
    if (!paper.id || !paper.url) return;
    await captureSnapshot(paper.url);
  }, [paper.id, paper.url, captureSnapshot]);

  return {
    rawScopeId,
    fileInputRef,
    isUploadingFile,
    handleFileSelect,
    isAddingLink,
    linkUrlInput,
    setLinkUrlInput,
    linkTitleInput,
    setLinkTitleInput,
    isSubmittingLink,
    handleOpenLinkForm,
    handleCancelLink,
    handleSubmitLinkAttachment,
    primaryAttachment,
    otherAttachments,
    hasSnapshot,
    paperUrl,
    handleOpenReader,
    handleDownload,
    isDownloadingAnnotated,
    handleDownloadAnnotatedPdf,
    isSettingPrimary,
    handleSetPrimary,
    isCapturingSnapshot,
    handleCaptureSnapshot,
    renameAttachmentMutation,
  };
}
