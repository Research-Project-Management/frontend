import type React from 'react';
import type {
  Column,
  Label,
  Priority,
  ProjectMember,
  Item,
} from './work-item.types';

export interface DatePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: string | null;
  dueDate: string | null;
  onApplyDates: (payload: {
    startDate: string | null;
    dueDate: string | null;
  }) => void;
  actionBtnClass?: string;
  label?: React.ReactNode;
  children?: React.ReactNode;
  isReadOnly?: boolean;
}

export interface SingleDatePopoverProps {
  label: string;
  date: string;
  onSelectDate: (dateString: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionBtnClass?: string;
  variant?: 'outline' | 'ghost' | 'default' | 'secondary';
  disabled?: boolean;
  isReadOnly?: boolean;
  children?: React.ReactNode;
}

export interface LabelPopoverProps {
  labels?: string[] | Label[];
  setLabels?: React.Dispatch<React.SetStateAction<string[]>>;
  actionBtnClass?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  isReadOnly?: boolean;
  iconOnly?: boolean;
  children?: React.ReactNode;
  selectedLabelIds?: string[];
  onToggleLabel?: (labelId: string) => void;
  onCreateLabel?: (name: string, color?: string) => Promise<Label | null | void>;
}

export interface MemberPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigneeId?: string | null;
  setAssigneeId?: (id: string | null) => void;
  assigneeIds?: string[];
  setAssigneeIds?: (ids: string[]) => void;
  members: ProjectMember[];
  actionBtnClass?: string;
  triggerLabel?: string;
  isMulti?: boolean;
  disabled?: boolean;
  isReadOnly?: boolean;
  selectedMemberIds?: string[];
  onToggleMember?: (memberId: string) => void;
  children?: React.ReactNode;
}

export interface ParentItemPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string | null;
  setParentId?: (parentId: string | null) => void;
  items?: Item[];
  actionBtnClass?: string;
  isReadOnly?: boolean;
  currentParentId?: string | null;
  availableItems?: Item[];
  onSelectParent?: (parentId: string | null) => void;
  children?: React.ReactNode;
}

export interface PriorityPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priority: Priority;
  setPriority?: (priority: Priority) => void;
  onSelectPriority?: (priority: Priority) => void;
  actionBtnClass?: string;
  isReadOnly?: boolean;
  defaultLabel?: string;
  children?: React.ReactNode;
}

export interface ProjectSelectorPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: {
    id?: string;
    name?: string;
    identifier?: string;
    emoji?: string | null;
  } | null;
  projects?: Array<{ id: string; name?: string; identifier?: string; emoji?: string | null }>;
  onSelectProject: (project: { id: string; name?: string; identifier?: string }) => void;
  disabled?: boolean;
  currentProjectId?: string;
  children?: React.ReactNode;
  actionBtnClass?: string;
  isReadOnly?: boolean;
}

export interface StatePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId?: string;
  setColumnId?: (columnId: string) => void;
  currentStateId?: string;
  columns?: Column[];
  onSelectState?: (stateId: string) => void;
  actionBtnClass?: string;
  isReadOnly?: boolean;
  children?: React.ReactNode;
}
