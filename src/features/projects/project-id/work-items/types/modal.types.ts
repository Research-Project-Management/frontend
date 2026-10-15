import type {
  Item,
  Column,
  Project,
  ProjectMember,
  ItemMutationInput,
  Relation,
  ModalState,
} from './work-item.types';

export type { ModalState };

export interface WorkItemModalsProps {
  modal: ModalState;
  onCloseModal: () => void;
  columns: Column[];
  members: ProjectMember[];
  project?: Project;
  projectId: string;
  allItems: Item[];
  isSaving: boolean;
  isDeleting: boolean;
  isReadOnly?: boolean;
  onCreateItem: (data: ItemMutationInput & { createMore?: boolean }) => Promise<void> | void;
  onSaveCard: (data: ItemMutationInput) => Promise<void> | void;
  onDeleteCard: () => void;
  onConfirmDelete: () => Promise<void> | void;
  onDuplicateCard: () => void;
  // Analytics
  isAnalyticsOpen?: boolean;
  onCloseAnalytics?: () => void;
  analyticsItems?: Item[];
  analyticsAssignees?: ProjectMember[];
}

export type DetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Partial<Item>;
  card?: Partial<Item>;
  columns: Column[];
  project?: Project;
  members?: ProjectMember[];
  availableItems?: Item[];
  onSave: (data: ItemMutationInput) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  isReadOnly?: boolean;
};

export interface CreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: Column[];
  members?: ProjectMember[];
  initialData?: Partial<Item>;
  project?: {
    id?: string;
    name?: string;
    identifier?: string;
    emoji?: string | null;
    icon?: string | null;
    modules?: string[];
  } | null;
  availableItems?: Item[];
  onSubmit: (data: ItemMutationInput & { createMore?: boolean }) => Promise<void> | void;
  isSubmitting?: boolean;
}

export interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
}

export interface RelationsProps {
  relations?: Relation[];
  currentItemId?: string;
  currentWorkItemId?: string;
  availableItems?: Item[];
  onAddRelation: (relation: Relation) => void;
  onRemoveRelation: (relationId: string, targetId?: string) => void;
  isReadOnly?: boolean;
}
