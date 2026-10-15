import type {
  AttachPageItem,
  AttachPaperItem,
  AttachFileItem,
  AttachLinkItem,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import type { AttachCenterData, ItemAttachment } from '@/features/projects/project-id/work-items/types/attachment.types';
import type { ActivityEntry } from '@/features/projects/project-id/work-items/types/activity.types';
import { ItemHelpers } from './work-item.utils';
import { formatBytes } from '@/shared/utils/format';

export const EMPTY_ATTACHMENTS: AttachCenterData = {
  pages: [],
  papers: [],
  files: [],
  links: [],
};

export const normalizeAttachments = (raw: unknown): AttachCenterData => {
  if (!raw) return { pages: [], papers: [], files: [], links: [] };
  if (Array.isArray(raw)) {
    return { pages: [], papers: [], files: raw as ItemAttachment[], links: [] };
  }
  const obj = raw as Partial<AttachCenterData>;
  return {
    pages: Array.isArray(obj.pages) ? obj.pages : [],
    papers: Array.isArray(obj.papers) ? obj.papers : [],
    files: Array.isArray(obj.files) ? obj.files : [],
    links: Array.isArray(obj.links) ? obj.links : [],
  };
};

export const AttachmentStateHelpers = {
  addPage: (prev: AttachCenterData, page: { pageId: string; title: string }): AttachCenterData => {
    const existing = prev.pages || [];
    if (
      existing.some(
        (p: { pageId?: string; id?: string }) => p.pageId === page.pageId || p.id === page.pageId,
      )
    ) {
      return prev;
    }
    return {
      ...prev,
      pages: [
        ...existing,
        {
          id: page.pageId,
          pageId: page.pageId,
          title: page.title,
          addedAt: new Date().toISOString(),
        } as AttachPageItem,
      ],
    };
  },

  removePage: (prev: AttachCenterData, pageId: string): AttachCenterData => ({
    ...prev,
    pages: (prev.pages || []).filter(
      (p: { pageId?: string; id?: string }) => p.pageId !== pageId && p.id !== pageId,
    ),
  }),

  addPaper: (
    prev: AttachCenterData,
    paper: { paperId: string; title: string; doi?: string; citationKey?: string },
  ): AttachCenterData => {
    const existing = prev.papers || [];
    if (
      existing.some(
        (p: { paperId?: string; id?: string }) =>
          p.paperId === paper.paperId || p.id === paper.paperId,
      )
    ) {
      return prev;
    }
    return {
      ...prev,
      papers: [
        ...existing,
        {
          id: paper.paperId,
          paperId: paper.paperId,
          title: paper.title,
          doi: paper.doi,
          citationKey: paper.citationKey,
          addedAt: new Date().toISOString(),
        } as AttachPaperItem,
      ],
    };
  },

  removePaper: (prev: AttachCenterData, paperId: string): AttachCenterData => ({
    ...prev,
    papers: (prev.papers || []).filter(
      (p: { paperId?: string; id?: string }) => p.paperId !== paperId && p.id !== paperId,
    ),
  }),

  addFile: (
    prev: AttachCenterData,
    file: { name: string; url: string; size?: number; type?: string; fileId?: string },
  ): AttachCenterData => {
    const newFile: AttachFileItem = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: file.name,
      url: file.url,
      size: typeof file.size === 'number' ? formatBytes(file.size) : undefined,
      type: file.type,
      createdAt: new Date().toISOString(),
      ...(file.fileId ? { fileId: file.fileId } : {}),
    };
    return {
      ...prev,
      files: [...(prev.files || []), newFile],
    };
  },

  removeFile: (prev: AttachCenterData, fileId: string): AttachCenterData => {
    const fileToRemove = (prev.files || []).find((f) => f.id === fileId);
    if (fileToRemove?.url?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(fileToRemove.url);
      } catch {}
    }
    return {
      ...prev,
      files: (prev.files || []).filter((f) => f.id !== fileId),
    };
  },

  renameFile: (prev: AttachCenterData, attachmentId: string, newName: string): AttachCenterData => ({
    ...prev,
    files: (prev.files || []).map((a) => (a.id === attachmentId ? { ...a, name: newName } : a)),
  }),

  addLink: (prev: AttachCenterData, link: { title: string; url: string }): AttachCenterData => ({
    ...prev,
    links: [
      ...(prev.links || []),
      {
        title: link.title,
        url: link.url,
        addedAt: new Date().toISOString(),
      } as AttachLinkItem,
    ],
  }),

  removeLink: (prev: AttachCenterData, linkIndexOrUrl: number | string): AttachCenterData => {
    const links = prev.links || [];
    if (typeof linkIndexOrUrl === 'number') {
      return {
        ...prev,
        links: links.filter((_, idx) => idx !== linkIndexOrUrl),
      };
    }
    const asNumber = Number(linkIndexOrUrl);
    if (!Number.isNaN(asNumber) && String(asNumber) === linkIndexOrUrl.trim()) {
      return {
        ...prev,
        links: links.filter((_, idx) => idx !== asNumber),
      };
    }
    return {
      ...prev,
      links: links.filter((l) => l.url !== linkIndexOrUrl && l.title !== linkIndexOrUrl),
    };
  },
};


export function createAttachmentHandlers(
  updateAttachments: (updater: (prev: AttachCenterData) => AttachCenterData) => void,
  onAfterAdd?: () => void,
) {
  const handleDetachFile = (fileId: string) => {
    updateAttachments((prev) => AttachmentStateHelpers.removeFile(prev, fileId));
  };

  return {
    handleAttachPage: (page: { pageId: string; title: string }) => {
      updateAttachments((prev) => AttachmentStateHelpers.addPage(prev, page));
      onAfterAdd?.();
    },
    handleDetachPage: (pageId: string) => {
      updateAttachments((prev) => AttachmentStateHelpers.removePage(prev, pageId));
    },
    handleAttachPaper: (paper: {
      paperId: string;
      title: string;
      doi?: string;
      citationKey?: string;
    }) => {
      updateAttachments((prev) => AttachmentStateHelpers.addPaper(prev, paper));
      onAfterAdd?.();
    },
    handleDetachPaper: (paperId: string) => {
      updateAttachments((prev) => AttachmentStateHelpers.removePaper(prev, paperId));
    },
    handleAttachFile: (file: {
      name: string;
      url: string;
      size?: number;
      type?: string;
      fileId?: string;
    }) => {
      updateAttachments((prev) => AttachmentStateHelpers.addFile(prev, file));
      onAfterAdd?.();
    },
    handleDetachFile,
    handleAttachLink: (link: { title: string; url: string }) => {
      updateAttachments((prev) => AttachmentStateHelpers.addLink(prev, link));
      onAfterAdd?.();
    },
    handleDetachLink: (linkIndex: number | string) => {
      updateAttachments((prev) => AttachmentStateHelpers.removeLink(prev, linkIndex));
    },
    handleRenameAttachment: (attachmentId: string, newName: string) => {
      updateAttachments((prev) =>
        AttachmentStateHelpers.renameFile(prev, attachmentId, newName),
      );
    },
    handleRemoveAttachment: handleDetachFile,
  };
}

export function buildActivityEntries(itemComments: unknown, itemActivity: unknown): ActivityEntry[] {
  const commentsRecord = itemComments as {
    comments?: Array<Record<string, unknown>>;
    data?: Array<Record<string, unknown>>;
  } | undefined;
  const commentsList: Array<Record<string, unknown>> = Array.isArray(itemComments)
    ? (itemComments as Array<Record<string, unknown>>)
    : Array.isArray(commentsRecord?.comments)
    ? commentsRecord.comments
    : Array.isArray(commentsRecord?.data)
    ? commentsRecord.data
    : [];

  const commentEntries: ActivityEntry[] = commentsList.map((c) => {
    let reactionEmoji: string | undefined = undefined;
    const cReactions = c.reactions;
    if (cReactions) {
      if (typeof cReactions === 'object' && !Array.isArray(cReactions)) {
        const activeEmojis = Object.entries(cReactions as Record<string, unknown>)
          .filter(([_, uids]) => Array.isArray(uids) && uids.length > 0)
          .map(([emoji]) => emoji);
        if (activeEmojis.length > 0) {
          reactionEmoji = activeEmojis.join(' ');
        }
      } else if (Array.isArray(cReactions) && cReactions.length > 0) {
        const first = cReactions[0] as { emoji?: string } | string | undefined;
        reactionEmoji =
          typeof first === 'object' && first ? first.emoji : (first as string | undefined);
      }
    }

    const authorObj = c.author as { name?: string; avatar?: string } | undefined;
    const cCreatedAt = typeof c.createdAt === 'string' ? c.createdAt : undefined;

    return {
      id: (c.id as string) || `c_${Math.random()}`,
      kind: 'comment',
      author: authorObj?.name || 'User',
      avatarUrl: authorObj?.avatar,
      authorInitials: ItemHelpers.getInitials(authorObj?.name),
      content: (c.content as string) || '',
      timestamp: ItemHelpers.formatActivityTime(cCreatedAt),
      createdAt: cCreatedAt ? new Date(cCreatedAt).getTime() : Date.now(),
      reactionEmoji,
      permissions: {
        canEdit: true,
        canDelete: true,
      },
    };
  });

  const activityRecord = itemActivity as {
    activity?: Array<Record<string, unknown>>;
    activities?: Array<Record<string, unknown>>;
    data?: Array<Record<string, unknown>>;
  } | undefined;
  const activityList: Array<Record<string, unknown>> = Array.isArray(itemActivity)
    ? (itemActivity as Array<Record<string, unknown>>)
    : Array.isArray(activityRecord?.activity)
    ? activityRecord.activity
    : Array.isArray(activityRecord?.activities)
    ? activityRecord.activities
    : Array.isArray(activityRecord?.data)
    ? activityRecord.data
    : [];

  const logEntries: ActivityEntry[] = activityList.map((a) => {
    const userObj = a.user as { name?: string; avatar?: string } | undefined;
    const authorObj = a.author as { name?: string; avatar?: string } | undefined;
    const authorName = userObj?.name || authorObj?.name;
    const aCreatedAt = typeof a.createdAt === 'string' ? a.createdAt : undefined;

    return {
      id: (a.id as string) || `log_${Math.random()}`,
      kind: 'activity',
      author: authorName || 'System',
      avatarUrl: userObj?.avatar || authorObj?.avatar,
      authorInitials: ItemHelpers.getInitials(authorName),
      content: (a.message as string) || (a.action as string) || 'updated this item',
      timestamp: ItemHelpers.formatActivityTime(aCreatedAt),
      createdAt: aCreatedAt ? new Date(aCreatedAt).getTime() : Date.now(),
    };
  });

  return [...commentEntries, ...logEntries].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  );
}

export const formatMetaDate = (dateStr?: string | null): string | null => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
};

export const getTimeAgo = (dateStr?: string | null): string => {
  if (!dateStr) return 'recently';
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} months ago`;
  } catch {
    return 'recently';
  }
};

