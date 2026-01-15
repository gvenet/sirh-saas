import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PageType } from '../entities/entity-page.entity';
import { FieldDisplayType } from '../entities/page-field.entity';

export class CreatePageFieldDto {
  @IsString()
  fieldName: string;

  @IsOptional()
  @IsString()
  fieldPath?: string;

  @IsOptional()
  @IsEnum(FieldDisplayType)
  displayType?: FieldDisplayType;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsNumber()
  colSpan?: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsBoolean()
  readOnly?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsObject()
  validation?: Record<string, any>;
}

export class CreateEntityPageDto {
  @IsString()
  entityName: string;

  @IsEnum(PageType)
  pageType: PageType;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePageFieldDto)
  fields?: CreatePageFieldDto[];
}
