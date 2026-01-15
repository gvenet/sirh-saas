import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/create-application.dto';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/create-menu-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  // Applications
  @Get()
  findAll() {
    return this.applicationService.findAllApplications();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.applicationService.findApplicationById(id);
  }

  @Post()
  create(@Body() dto: CreateApplicationDto) {
    return this.applicationService.createApplication(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateApplicationDto) {
    return this.applicationService.updateApplication(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.applicationService.deleteApplication(id);
  }

  // Menu Items
  @Get('menu-items/all')
  findAllMenuItems() {
    return this.applicationService.findAllMenuItems();
  }

  @Post('menu-items')
  createMenuItem(@Body() dto: CreateMenuItemDto) {
    return this.applicationService.createMenuItem(dto);
  }

  @Put('menu-items/:id')
  updateMenuItem(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.applicationService.updateMenuItem(id, dto);
  }

  @Delete('menu-items/:id')
  removeMenuItem(@Param('id') id: string) {
    return this.applicationService.deleteMenuItem(id);
  }
}
