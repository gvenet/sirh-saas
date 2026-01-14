import { IsString, IsNumber, IsBoolean, IsDate, IsEmail, IsOptional } from 'class-validator';

export class CreateTestDto {
  @IsString()
  test: string;
}
