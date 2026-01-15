import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { EntityPageService } from './entity-page.service';
import { CreateEntityPageDto, CreatePageFieldDto } from './dto/create-entity-page.dto';
import { UpdateEntityPageDto, UpdatePageFieldDto } from './dto/update-entity-page.dto';
import { PageType } from './entities/entity-page.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('entity-pages')
@UseGuards(JwtAuthGuard)
export class EntityPageController {
  constructor(private readonly pageService: EntityPageService) {}

  // Pages
  @Get()
  findAll(@Query('entityName') entityName?: string) {
    if (entityName) {
      return this.pageService.findByEntity(entityName);
    }
    return this.pageService.findAll();
  }

  @Get('default/:entityName/:pageType')
  findDefault(
    @Param('entityName') entityName: string,
    @Param('pageType') pageType: PageType,
  ) {
    return this.pageService.findDefaultPage(entityName, pageType);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pageService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEntityPageDto) {
    return this.pageService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEntityPageDto) {
    return this.pageService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pageService.remove(id);
  }

  // Fields
  @Post(':pageId/fields')
  addField(@Param('pageId') pageId: string, @Body() dto: CreatePageFieldDto) {
    return this.pageService.addField(pageId, dto);
  }

  @Put('fields/:fieldId')
  updateField(@Param('fieldId') fieldId: string, @Body() dto: UpdatePageFieldDto) {
    return this.pageService.updateField(fieldId, dto);
  }

  @Delete('fields/:fieldId')
  removeField(@Param('fieldId') fieldId: string) {
    return this.pageService.removeField(fieldId);
  }

  @Put(':pageId/fields/reorder')
  reorderFields(@Param('pageId') pageId: string, @Body() body: { fieldIds: string[] }) {
    return this.pageService.reorderFields(pageId, body.fieldIds);
  }
}
