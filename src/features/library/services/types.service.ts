import { apiGet, apiPost } from '@/shared/lib/api';
import type {
  SchemaItemTypeDefinition,
  ItemFieldDefinition,
  CreatorTypeDefinition,
} from '../schemas/item-type.schema';

export interface ItemTypesResponse {
  success: boolean;
  registryVersion: number;
  schemaVersion: number;
  source: string;
  itemTypes: SchemaItemTypeDefinition[];
  data: SchemaItemTypeDefinition[];
}

export interface ItemTypeDetailResponse {
  success: boolean;
  itemType: SchemaItemTypeDefinition;
  data: SchemaItemTypeDefinition;
}

export interface ItemTypeFieldsResponse {
  success: boolean;
  itemType: string;
  fields: ItemFieldDefinition[];
  count: number;
}

export interface SchemaValidationResult {
  valid: boolean;
  itemType: string;
  errors: string[];
  warnings: string[];
  harmonizedCreators?: Array<{
    originalRole: string;
    normalizedRole: string;
    creatorName: string;
    reason: string;
  }>;
  demotedFields?: Record<string, unknown>;
  sanitizedPayload?: Record<string, unknown>;
}

export const ItemTypesService = {
  /**
   * Retrieves all 40 item-type definitions from the Library schema registry.
   */
  getAllItemTypes: () => {
    return apiGet<ItemTypesResponse>('/api/v1/library/item-types');
  },

  /**
   * Retrieves definition for a specific item type.
   */
  getItemType: (itemType: string) => {
    return apiGet<ItemTypeDetailResponse>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}`,
    );
  },

  /**
   * Retrieves fields list for a specific item type.
   */
  getItemTypeFields: (itemType: string) => {
    return apiGet<ItemTypeFieldsResponse>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}/fields`,
    );
  },

  /**
   * Validates an item payload against the backend Zotero Schema v42 validator.
   */
  validateItem: (itemType: string, payload: Record<string, unknown>) => {
    return apiPost<{ success: boolean; result: SchemaValidationResult }>(
      `/api/v1/library/item-types/${encodeURIComponent(itemType)}/validate`,
      payload,
    );
  },
};

export const TypesService = ItemTypesService;
