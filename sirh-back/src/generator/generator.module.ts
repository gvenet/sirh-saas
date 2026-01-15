import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratorController } from './generator.controller';
import { GeneratorService } from './generator.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [GeneratorController],
  providers: [GeneratorService]
})
export class GeneratorModule {}
