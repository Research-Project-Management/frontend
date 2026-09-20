import { apiGet, apiPost } from '@/shared/lib/api';
import type {
  SchemaItemTypeDefinition,
  ItemFieldDefinition,
} from '../../types';

export interface ItemTypesResponse {
  success: boolean;
  registryVersion: number;
  schemaVersion: number;
  source: string;
  itemTypes: SchemaItemTypeDefinition[];
  data: SchemaItemTypeDefinition[];
  baseFieldMappings?: Record<string, Record<string, string>>;
  reverseBaseFieldMappings?: Record<string, Record<string, string>>;
  creatorRoles?: Record<string, string>;
  cslTypeMap?: Record<string, string>;
  cslFieldMap?: Record<string, string>;
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
   * Retrieves all item-type definitions and Zotero schema mappings from the Library schema registry.
   */
  getAllItemTypes: () => {
    return apiGet<ItemTypesResponse>('/api/v1/library/item-types');
  },

  /**
   * Retrieves complete Zotero schema snapshot from the backend.
   */
  getSchemaSnapshot: () => {
    return apiGet<any>('/api/v1/library/item-types/schema');
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
