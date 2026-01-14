import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FieldDto } from './field.dto';

export class CreateEntityDto {
  @IsString()
  name: string;

  @IsString()
  tableName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDto)
  fields: FieldDto[];
}
