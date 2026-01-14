import { IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';

export enum FieldType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  TEXT = 'text',
  EMAIL = 'email',
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
}
