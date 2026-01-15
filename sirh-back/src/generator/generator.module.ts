import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratorController } from './generator.controller';
import { GeneratorService } from './generator.service';
import { EntityPageModule } from '../entity-page/entity-page.module';

@Module({
  imports: [TypeOrmModule.forFeature([]), EntityPageModule],
  controllers: [GeneratorController],
  providers: [GeneratorService]
})
export class GeneratorModule {}
