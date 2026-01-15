import { IsString, IsNumber, IsBoolean, IsDate, IsEmail, IsOptional } from 'class-validator';

export class CreateSkillDto {
  @IsString()
  description: string;

}
