import { Controller, Post, Body, UseGuards, Get, Param, Put, Delete } from '@nestjs/common';
import { GeneratorService } from './generator.service';
import { CreateEntityDto } from './dto/create-entity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('generator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class GeneratorController {
  constructor(private readonly generatorService: GeneratorService) {}

  @Post('entity')
  async generateEntity(@Body() createEntityDto: CreateEntityDto) {
    return this.generatorService.generateEntity(createEntityDto);
  }

  @Get('entities')
  async listEntities() {
    return this.generatorService.listEntities();
  }

  @Get('entity/:name')
  async getEntity(@Param('name') name: string) {
    return this.generatorService.getEntitySchema(name);
  }

  @Put('entity/:name')
  async updateEntity(@Param('name') name: string, @Body() updateEntityDto: CreateEntityDto) {
    return this.generatorService.updateEntity(name, updateEntityDto);
  }

  @Delete('entity/:name')
  async deleteEntity(@Param('name') name: string) {
    return this.generatorService.deleteEntity(name);
  }
}
