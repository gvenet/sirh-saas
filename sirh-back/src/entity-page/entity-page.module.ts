import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityPage } from './entities/entity-page.entity';
import { PageField } from './entities/page-field.entity';
import { EntityPageService } from './entity-page.service';
import { EntityPageController } from './entity-page.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EntityPage, PageField])],
  controllers: [EntityPageController],
  providers: [EntityPageService],
  exports: [EntityPageService],
})
export class EntityPageModule {}
