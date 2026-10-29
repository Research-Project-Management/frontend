'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getItemFileUrl, isProjectScope } from '@/features/library/domain/item-url';
import { resolveLibraryUrl, resolveLibraryRawPath } from '@/features/library/sdk/library.client';
import { triggerBrowserUrlDownload, openInNewTab } from '@/features/library/core/coordinator/browser-io.helpers';
import {
  useAttachments,
  useRenameAttachment,
  useUploadAttachmentMutation,
} from '@/features/library/sdk/queries/extraction.queries';
import { useReResolveItemMetadataMutation } from '@/features/library/sdk/queries/catalog.queries';
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

function resolveAttachmentUrl(att: AttachmentLike, scopeId?: string): string {
  if (att.fileId) {
    return resolveLibraryUrl(
      'extraction',
      `/files/${encodeURIComponent(att.fileId)}/content`,
      scopeId,
    );
  }
  const raw = getItemFileUrl(
    {
      fileUrl: att.fileUrl || att.url,
      url: att.url,
      fileId: att.fileId,
    },
    scopeId,
  );
  return raw ? resolveLibraryRawPath(raw, 'extraction') : '';
}

export function useAttachmentCoordinator({
  item: paper,
  scopeId,
  onRegisterAdd,
}: UseAttachmentCoordinatorParams) {
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
    remove: removeAttachment,
    isDeleting,
  } = useAttachments(rawScopeId, paper.id || '');
  const uploadAttachmentMutation = useUploadAttachmentMutation(rawScopeId);
  const renameAttachmentMutation = useRenameAttachment(rawScopeId);
  const reResolveMetadataMutation = useReResolveItemMetadataMutation(rawScopeId);

  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTitleInput, setLinkTitleInput] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(null);
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
    setSelectedAttachmentId(null);
  }, [paper.id]);

  useEffect(() => {
    if (onRegisterAdd) {
      onRegisterAdd(() => {
        fileInputRef.current?.click();
      });
    }
  }, [onRegisterAdd]);

  const rawAttachments = paper.attachments || EMPTY_ATTACHMENTS;
  const paperUrl = getItemFileUrl(paper, rawScopeId);
  const paperFilename = paper.filename;

  const allAttachments = useMemo<AttachmentLike[]>(() => {
    const list = [...(rawAttachments as AttachmentLike[])];
    // Deduplicate by fileId (preferring primary_pdf first) or id
    const seenIds = new Set<string>();
    const seenFileIds = new Set<string>();

    // Sort primary_pdf first so deduplication keeps primary_pdf
    list.sort((a, b) => {
      const aPrimary = a.attachmentType === 'primary_pdf' || a.type === 'primary_pdf' ? 0 : 1;
      const bPrimary = b.attachmentType === 'primary_pdf' || b.type === 'primary_pdf' ? 0 : 1;
      return aPrimary - bPrimary;
    });

    const deduped: AttachmentLike[] = [];
    for (const att of list) {
      if (att.id && seenIds.has(att.id)) continue;
      if (att.fileId && seenFileIds.has(att.fileId)) continue;
      if (att.id) seenIds.add(att.id);
      if (att.fileId) seenFileIds.add(att.fileId);
      deduped.push(att);
    }

    return deduped;
  }, [rawAttachments]);

  const primaryAttachment = useMemo(() => {
    return (
      allAttachments.find(
        (att) =>
          att.attachmentType === 'primary_pdf' ||
          att.type === 'primary_pdf' ||
          (paperFilename && (att.filename === paperFilename || att.name === paperFilename)),
      ) ||
      allAttachments.find(
        (att) =>
          att.mimeType === 'application/pdf' ||
          att.filename?.toLowerCase().endsWith('.pdf'),
      ) ||
      null
    );
  }, [allAttachments, paperFilename]);

  const otherAttachments = useMemo(() => {
    return allAttachments.filter((att) => att !== primaryAttachment);
  }, [allAttachments, primaryAttachment]);

  const activePreviewAttachment = useMemo(() => {
    if (selectedAttachmentId) {
      const found = allAttachments.find((att) => att.id === selectedAttachmentId);
      if (
        found &&
        (found.mimeType === 'application/pdf' ||
          found.filename?.toLowerCase().endsWith('.pdf') ||
          found.attachmentType === 'primary_pdf')
      ) {
        return found;
      }
    }
    return primaryAttachment;
  }, [selectedAttachmentId, allAttachments, primaryAttachment]);

  const activePreviewUrl = useMemo(() => {
    if (activePreviewAttachment) {
      const resolved = resolveAttachmentUrl(activePreviewAttachment, rawScopeId);
      if (resolved) return resolved;
    }
    // Only return paperUrl if paper actually has a direct file attachment / resolved file URL
    return paperUrl || '';
  }, [activePreviewAttachment, rawScopeId, paperUrl]);

  const hasSnapshot = useMemo(() => {
    return allAttachments.some(
      (att) =>
        att.linkMode === 'imported_url' ||
        att.attachmentType === 'snapshot' ||
        att.attachmentType === 'web_snapshot' ||
        att.mimeType === 'text/html' ||
        att.filename?.toLowerCase().endsWith('.html'),
    );
  }, [allAttachments]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const targetItemId = paper.id;
      if (!file || !targetItemId) return;
      try {
        setIsUploadingFile(true);
        const uploaded = await uploadAttachmentMutation.mutateAsync(file);
        if (!isMountedRef.current || paper.id !== targetItemId) return;
        const isFirstPdf =
          file.type === 'application/pdf' &&
          !allAttachments.some(
            (a) =>
              a.attachmentType === 'primary_pdf' ||
              a.mimeType === 'application/pdf',
          );
        await addAttachment({
          itemId: targetItemId,
          fileId: uploaded.fileId,
          filename: uploaded.filename,
          url: uploaded.url,
          size: uploaded.size,
          mimeType: uploaded.mimeType,
          linkMode: 'imported_file',
          attachmentType: isFirstPdf ? 'primary_pdf' : 'supplementary',
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
    [paper.id, uploadAttachmentMutation, addAttachment, allAttachments],
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

  const handleOpenReader = useCallback(
    (attachmentId?: string) => {
      if (!paper.id) return;
      const urlParams = new URLSearchParams(searchParams.toString());
      if (attachmentId && allAttachments.length > 1) {
        urlParams.set('attachmentId', attachmentId);
      } else {
        urlParams.delete('attachmentId');
      }
      const projectParam =
        urlParams.get('projectId') ||
        (paper.projectId ? String(paper.projectId) : undefined) ||
        (rawScopeId && isProjectScope(rawScopeId) ? rawScopeId : undefined);
      if (projectParam && !urlParams.has('projectId')) {
        urlParams.set('projectId', projectParam);
      }
      const qs = urlParams.toString();
      openInNewTab(`/library/papers/${paper.id}${qs ? `?${qs}` : ''}`);
    },
    [paper.id, paper.projectId, rawScopeId, allAttachments.length, searchParams],
  );

  const handleDownload = useCallback((url: string, filename: string) => {
    triggerBrowserUrlDownload(url, filename);
  }, []);

  const handleSetPrimary = useCallback(
    async (attachmentId: string) => {
      if (!paper.id || !attachmentId) return;
      try {
        await setPrimary(attachmentId);
        setSelectedAttachmentId(attachmentId);
      } catch {
        // Notification handled inside useAttachments
      }
    },
    [paper.id, setPrimary],
  );

  const handleDeleteAttachment = useCallback(
    async (attachmentId: string) => {
      if (!paper.id || !attachmentId) return;
      try {
        await removeAttachment({ attachmentId, itemId: paper.id });
        if (selectedAttachmentId === attachmentId) {
          setSelectedAttachmentId(null);
        }
      } catch {
        // Notification handled inside useAttachments
      }
    },
    [paper.id, removeAttachment, selectedAttachmentId],
  );

  const handleCaptureSnapshot = useCallback(async () => {
    if (!paper.id || !paper.url) return;
    await captureSnapshot(paper.url);
  }, [paper.id, paper.url, captureSnapshot]);

  const getAttachmentDownloadUrl = useCallback(
    (att: AttachmentLike) => resolveAttachmentUrl(att, rawScopeId),
    [rawScopeId],
  );

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
    allAttachments,
    primaryAttachment,
    otherAttachments,
    activePreviewAttachment,
    activePreviewUrl,
    selectedAttachmentId,
    setSelectedAttachmentId,
    getAttachmentDownloadUrl,
    hasSnapshot,
    paperUrl,
    handleOpenReader,
    handleDownload,
    isSettingPrimary,
    handleSetPrimary,
    isDeleting,
    handleDeleteAttachment,
    isCapturingSnapshot,
    handleCaptureSnapshot,
    renameAttachmentMutation,
    reResolveMetadataMutation,
  };
}
