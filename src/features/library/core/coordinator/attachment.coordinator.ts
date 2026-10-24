'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getItemFileUrl } from '@/features/library/domain/item-url';
import {
  useAttachments,
  useRenameAttachment,
  useUploadAttachmentMutation,
  useDownloadAnnotatedPdfMutation,
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

export function useAttachmentCoordinator({
  item: paper,
  scopeId,
  onRegisterAdd,
}: UseAttachmentCoordinatorParams) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const routeProjectId = typeof params?.projectId === 'string' ? params.projectId : undefined;
  const rawScopeId = scopeId || paper.projectId || routeProjectId || 'user';

  const {
    captureSnapshot,
    isCapturingSnapshot,
    setPrimary,
    isSettingPrimary,
    add: addAttachment,
  } = useAttachments(rawScopeId, paper.id || '');
  const uploadAttachmentMutation = useUploadAttachmentMutation(rawScopeId);
  const downloadAnnotatedMutation = useDownloadAnnotatedPdfMutation(rawScopeId);
  const renameAttachmentMutation = useRenameAttachment(rawScopeId);

  const [isDownloadingAnnotated, setIsDownloadingAnnotated] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTitleInput, setLinkTitleInput] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setIsAddingLink(false);
    setLinkUrlInput('');
    setLinkTitleInput('');
  }, [paper.id]);

  useEffect(() => {
    if (onRegisterAdd) {
      onRegisterAdd(() => {
        fileInputRef.current?.click();
      });
    }
  }, [onRegisterAdd]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const targetItemId = paper.id;
      if (!file || !targetItemId) return;
      try {
        setIsUploadingFile(true);
        const uploaded = await uploadAttachmentMutation.mutateAsync(file);
        if (!isMountedRef.current || paper.id !== targetItemId) return;
        await addAttachment({
          itemId: targetItemId,
          filename: uploaded.filename,
          url: uploaded.url,
          size: uploaded.size,
          mimeType: uploaded.mimeType,
          linkMode: 'imported_file',
          attachmentType: 'supplementary',
        });
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        toast.error('Failed to attach file', {
          description: err instanceof Error ? err.message : 'Please try again.',
        });
      } finally {
        if (isMountedRef.current) {
          setIsUploadingFile(false);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [paper.id, uploadAttachmentMutation, addAttachment],
  );

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

  const handleOpenReader = useCallback(
    (attachmentId?: string) => {
      if (!paper.id) return;
      const urlParams = new URLSearchParams(searchParams.toString());
      if (attachmentId && rawAttachments.length > 1) {
        urlParams.set('attachmentId', attachmentId);
      } else {
        urlParams.delete('attachmentId');
      }
      const qs = urlParams.toString();
      router.push(`/library/papers/${paper.id}${qs ? `?${qs}` : ''}`);
    },
    [paper.id, rawAttachments.length, router, searchParams],
  );

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
      await downloadAnnotatedMutation.mutateAsync({
        itemId: paper.id,
        filename: `${paper.title || 'document'}-annotated.pdf`,
      });
      toast.success('Annotated PDF downloaded', { id: 'annotated-pdf-download' });
    } catch (err: unknown) {
      toast.error('Failed to export annotated PDF', {
        description: err instanceof Error ? err.message : 'Please verify that annotations exist or try again.',
        id: 'annotated-pdf-download',
      });
    } finally {
      setIsDownloadingAnnotated(false);
    }
  }, [paper.id, paper.title, downloadAnnotatedMutation]);

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
