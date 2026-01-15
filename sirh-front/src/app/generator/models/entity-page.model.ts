export enum PageType {
  VIEW = 'view',
  EDIT = 'edit',
  LIST = 'list',
  CUSTOM = 'custom'
}

export enum FieldDisplayType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  DATE = 'date',
  DATETIME = 'datetime',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  AUTOCOMPLETE = 'autocomplete',
  LIST = 'list',
  TABLE = 'table',
  HIDDEN = 'hidden'
}

export interface PageField {
  id: string;
  pageId: string;
  fieldName: string;
  fieldPath?: string;
  displayType: FieldDisplayType;
  label?: string;
  placeholder?: string;
  order: number;
  section?: string;
  colSpan: number;
  visible: boolean;
  readOnly: boolean;
  config?: Record<string, any>;
  validation?: Record<string, any>;
}

export interface EntityPage {
  id: string;
  entityName: string;
  pageType: PageType;
  name: string;
  description?: string;
  isDefault: boolean;
  order: number;
  active: boolean;
  config?: Record<string, any>;
  fields: PageField[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePageFieldDto {
  fieldName: string;
  fieldPath?: string;
  displayType?: FieldDisplayType;
  label?: string;
  placeholder?: string;
  order?: number;
  section?: string;
  colSpan?: number;
  visible?: boolean;
  readOnly?: boolean;
  config?: Record<string, any>;
  validation?: Record<string, any>;
}

export interface CreateEntityPageDto {
  entityName: string;
  pageType: PageType;
  name: string;
  description?: string;
  isDefault?: boolean;
  order?: number;
  active?: boolean;
  config?: Record<string, any>;
  fields?: CreatePageFieldDto[];
}
