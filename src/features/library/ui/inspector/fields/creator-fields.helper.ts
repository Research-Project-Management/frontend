import type { Item } from '@/features/library/domain/types/library.types';
import type { SchemaItemTypeDefinition } from '@/features/library/domain/types/item-types.types';
import {
  type CreatorEntry,
  type CreatorDraft,
  parseCreators,
  areCreatorsEqual,
  toItemCreators,
} from '@/features/library/domain/creators';

export type { CreatorEntry, CreatorDraft };
export { parseCreators, areCreatorsEqual, toItemCreators };

export interface CreatorFieldsProps {
  item?: Item;
  typeDefinition: SchemaItemTypeDefinition;
  canEdit?: boolean;
  onUpdateItem?: (data: Partial<Item>, options?: { silent?: boolean }) => void;
}

export const MAX_COLLAPSED_AUTHORS = 3;
