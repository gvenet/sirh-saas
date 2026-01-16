import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AaaService } from './aaa.service';
import { AaaController } from './aaa.controller';
import { Aaa } from './aaa.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Aaa])],
  controllers: [AaaController],
  providers: [AaaService],
  exports: [AaaService],
})
export class AaaModule {}
