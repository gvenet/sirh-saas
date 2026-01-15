import { IsString, IsEnum, IsBoolean, IsOptional, IsIn } from 'class-validator';

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

export class FieldDto {
  @IsString()
  name: string;

  @IsEnum(FieldType)
  type: FieldType;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsBoolean()
  @IsOptional()
  unique?: boolean;

  @IsString()
  @IsOptional()
  defaultValue?: string;

  // Propriétés pour les relations
  @IsString()
  @IsOptional()
  relationTarget?: string;

  @IsString()
  @IsOptional()
  relationInverse?: string;

  @IsIn(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'])
  @IsOptional()
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';

  @IsBoolean()
  @IsOptional()
  eager?: boolean;
}

export function isRelationType(type: FieldType): boolean {
  return [
    FieldType.MANY_TO_ONE,
    FieldType.ONE_TO_MANY,
    FieldType.MANY_TO_MANY,
    FieldType.ONE_TO_ONE,
  ].includes(type);
}
