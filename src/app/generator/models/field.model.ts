export enum FieldType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  TEXT = 'text',
  EMAIL = 'email',
}

export interface Field {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  defaultValue?: string;
}

export interface CreateEntityDto {
  name: string;
  tableName: string;
  fields: Field[];
}

export interface GeneratorResponse {
  message: string;
  path: string;
  files: string[];
}
