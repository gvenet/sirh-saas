export enum FieldType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  TEXT = 'text',
  EMAIL = 'email',
  // Types de relations
  MANY_TO_ONE = 'many-to-one',
  ONE_TO_MANY = 'one-to-many',
  MANY_TO_MANY = 'many-to-many',
  ONE_TO_ONE = 'one-to-one',
}

export type RelationType = FieldType.MANY_TO_ONE | FieldType.ONE_TO_MANY | FieldType.MANY_TO_MANY | FieldType.ONE_TO_ONE;

export interface Field {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  defaultValue?: string;
  // Propriétés pour les relations
  relationTarget?: string;        // Entité cible (ex: "User")
  relationInverse?: string;       // Propriété inverse dans l'entité cible
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  eager?: boolean;                // Charger automatiquement la relation
}

export function isRelationType(type: FieldType): boolean {
  return [
    FieldType.MANY_TO_ONE,
    FieldType.ONE_TO_MANY,
    FieldType.MANY_TO_MANY,
    FieldType.ONE_TO_ONE
  ].includes(type);
}

export interface IncomingRelation {
  sourceEntity: string;
  fieldName: string;
  relationType: string;
  inverseProperty: string;
}

export interface CreateEntityDto {
  name: string;
  tableName: string;
  fields: Field[];
  incomingRelations?: IncomingRelation[];
}

export interface GeneratorResponse {
  message: string;
  path: string;
  files: string[];
}

export interface EntityInfo {
  name: string;
  moduleName: string;
  path: string;
}
