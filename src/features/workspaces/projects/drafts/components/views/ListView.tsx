'use client';

import React from 'react';
import { ListItem } from './ListItem';
import type { WorkItemDraft } from '../../types/draft.types';

export interface ListViewProps {
  drafts: WorkItemDraft[];
  onEdit: (draft: WorkItemDraft) => void;
  onDuplicate: (draft: WorkItemDraft) => void;
  onMoveToProject: (draft: WorkItemDraft) => void;
  onDelete: (draft: WorkItemDraft) => void;
}

export const ListView: React.FC<ListViewProps> = ({
  drafts,
  onEdit,
  onDuplicate,
  onMoveToProject,
  onDelete,
}) => {
  return (
    <div className="flex flex-col border-b border-border divide-y divide-border">
      {drafts.map((draft) => (
        <ListItem
          key={draft.id}
          draft={draft}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onMoveToProject={onMoveToProject}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default ListView;
