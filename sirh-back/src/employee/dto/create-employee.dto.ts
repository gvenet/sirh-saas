import { IsString, IsNumber, IsBoolean, IsDate, IsEmail, IsOptional, IsUUID, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEmployeeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  skillsIds?: string[];
}
