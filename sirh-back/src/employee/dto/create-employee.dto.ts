import { IsString, IsNumber, IsBoolean, IsDate, IsEmail, IsOptional } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  name: string;

}
