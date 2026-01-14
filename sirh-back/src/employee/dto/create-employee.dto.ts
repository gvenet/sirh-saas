import { IsString, IsNumber, IsBoolean, IsDate, IsEmail, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEmployeeDto {
  @IsString()
  firstName: string;
  @IsString()
  lastName: string;
  @IsEmail()
  email: string;
  @Type(() => Date)
  @IsDate()
  hireDate: Date;
  @IsOptional()
  @IsNumber()
  salary: number;
}
