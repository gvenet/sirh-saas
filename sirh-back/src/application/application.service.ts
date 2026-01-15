import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from './entities/application.entity';
import { MenuItem } from './entities/menu-item.entity';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/create-application.dto';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/create-menu-item.dto';

@Injectable()
export class ApplicationService {
  constructor(
    @InjectRepository(Application)
    private applicationRepository: Repository<Application>,
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
  ) {}

  // Applications
  async findAllApplications(): Promise<Application[]> {
    return this.applicationRepository.find({
      order: { order: 'ASC' },
      relations: ['menuItems'],
    });
  }

  async findApplicationById(id: string): Promise<Application> {
    const app = await this.applicationRepository.findOne({
      where: { id },
      relations: ['menuItems'],
    });
    if (!app) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }
    return app;
  }

  async createApplication(dto: CreateApplicationDto): Promise<Application> {
    const app = this.applicationRepository.create(dto);
    return this.applicationRepository.save(app);
  }

  async updateApplication(id: string, dto: UpdateApplicationDto): Promise<Application> {
    const app = await this.findApplicationById(id);
    Object.assign(app, dto);
    return this.applicationRepository.save(app);
  }

  async deleteApplication(id: string): Promise<void> {
    const result = await this.applicationRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }
  }

  // Menu Items
  async findAllMenuItems(): Promise<MenuItem[]> {
    return this.menuItemRepository.find({
      order: { order: 'ASC' },
    });
  }

  async findMenuItemById(id: string): Promise<MenuItem> {
    const menuItem = await this.menuItemRepository.findOne({ where: { id } });
    if (!menuItem) {
      throw new NotFoundException(`MenuItem with ID ${id} not found`);
    }
    return menuItem;
  }

  async createMenuItem(dto: CreateMenuItemDto): Promise<MenuItem> {
    // Verify application exists
    await this.findApplicationById(dto.applicationId);
    const menuItem = this.menuItemRepository.create(dto);
    return this.menuItemRepository.save(menuItem);
  }

  async updateMenuItem(id: string, dto: UpdateMenuItemDto): Promise<MenuItem> {
    const menuItem = await this.findMenuItemById(id);
    Object.assign(menuItem, dto);
    return this.menuItemRepository.save(menuItem);
  }

  async deleteMenuItem(id: string): Promise<void> {
    const result = await this.menuItemRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`MenuItem with ID ${id} not found`);
    }
  }
}
