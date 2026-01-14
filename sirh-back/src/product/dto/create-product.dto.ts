import { IsString, IsNumber, IsBoolean, IsDate, IsEmail, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  name: string;
  @IsOptional()
  @IsString()
  description: string;
  @IsNumber()
  price: number;
  @IsBoolean()
  inStock: boolean;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  releaseDate: Date;
}
