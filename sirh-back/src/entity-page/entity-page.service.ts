import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntityPage, PageType } from './entities/entity-page.entity';
import { PageField, FieldDisplayType } from './entities/page-field.entity';
import { CreateEntityPageDto, CreatePageFieldDto } from './dto/create-entity-page.dto';
import { UpdateEntityPageDto, UpdatePageFieldDto } from './dto/update-entity-page.dto';

@Injectable()
export class EntityPageService {
  constructor(
    @InjectRepository(EntityPage)
    private pageRepository: Repository<EntityPage>,
    @InjectRepository(PageField)
    private fieldRepository: Repository<PageField>,
  ) {}

  // Pages
  async findAll(): Promise<EntityPage[]> {
    return this.pageRepository.find({
      order: { entityName: 'ASC', order: 'ASC' },
      relations: ['fields'],
    });
  }

  async findByEntity(entityName: string): Promise<EntityPage[]> {
    return this.pageRepository.find({
      where: { entityName },
      order: { order: 'ASC' },
      relations: ['fields'],
    });
  }

  async findOne(id: string): Promise<EntityPage> {
    const page = await this.pageRepository.findOne({
      where: { id },
      relations: ['fields'],
    });
    if (!page) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }
    return page;
  }

  async findDefaultPage(entityName: string, pageType: PageType): Promise<EntityPage | null> {
    return this.pageRepository.findOne({
      where: { entityName, pageType, isDefault: true },
      relations: ['fields'],
    });
  }

  async create(dto: CreateEntityPageDto): Promise<EntityPage> {
    const page = this.pageRepository.create({
      ...dto,
      fields: dto.fields?.map(f => this.fieldRepository.create(f)),
    });
    return this.pageRepository.save(page);
  }

  async update(id: string, dto: UpdateEntityPageDto): Promise<EntityPage> {
    const page = await this.findOne(id);

    // Si on met à jour les fields, on les remplace
    if (dto.fields) {
      // Supprimer les anciens fields
      await this.fieldRepository.delete({ pageId: id });
      // Créer les nouveaux
      page.fields = dto.fields.map(f => this.fieldRepository.create({ ...f, pageId: id }));
    }

    Object.assign(page, dto);
    return this.pageRepository.save(page);
  }

  async remove(id: string): Promise<void> {
    const result = await this.pageRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }
  }

  async removeByEntity(entityName: string): Promise<void> {
    await this.pageRepository.delete({ entityName });
  }

  // Fields
  async addField(pageId: string, dto: CreatePageFieldDto): Promise<PageField> {
    await this.findOne(pageId); // Vérifie que la page existe
    const field = this.fieldRepository.create({ ...dto, pageId });
    return this.fieldRepository.save(field);
  }

  async updateField(fieldId: string, dto: UpdatePageFieldDto): Promise<PageField> {
    const field = await this.fieldRepository.findOne({ where: { id: fieldId } });
    if (!field) {
      throw new NotFoundException(`Field with ID ${fieldId} not found`);
    }
    Object.assign(field, dto);
    return this.fieldRepository.save(field);
  }

  async removeField(fieldId: string): Promise<void> {
    const result = await this.fieldRepository.delete(fieldId);
    if (result.affected === 0) {
      throw new NotFoundException(`Field with ID ${fieldId} not found`);
    }
  }

  async reorderFields(pageId: string, fieldIds: string[]): Promise<void> {
    for (let i = 0; i < fieldIds.length; i++) {
      await this.fieldRepository.update(fieldIds[i], { order: i });
    }
  }

  // Génération des pages par défaut pour une entité
  async generateDefaultPages(entityName: string, entityFields: any[]): Promise<EntityPage[]> {
    const pages: EntityPage[] = [];

    // Mapper les types de champs vers les types d'affichage
    const mapFieldType = (type: string): FieldDisplayType => {
      const mapping: Record<string, FieldDisplayType> = {
        'STRING': FieldDisplayType.TEXT,
        'TEXT': FieldDisplayType.TEXTAREA,
        'NUMBER': FieldDisplayType.NUMBER,
        'BOOLEAN': FieldDisplayType.BOOLEAN,
        'DATE': FieldDisplayType.DATE,
        'EMAIL': FieldDisplayType.TEXT,
        'MANY_TO_ONE': FieldDisplayType.SELECT,
        'ONE_TO_MANY': FieldDisplayType.TABLE,
        'MANY_TO_MANY': FieldDisplayType.TABLE,
        'ONE_TO_ONE': FieldDisplayType.SELECT,
      };
      return mapping[type] || FieldDisplayType.TEXT;
    };

    // Créer les fields pour les pages
    const createFields = (readOnly: boolean): CreatePageFieldDto[] => {
      return entityFields.map((field, index) => ({
        fieldName: field.name,
        displayType: mapFieldType(field.type),
        label: field.name.charAt(0).toUpperCase() + field.name.slice(1).replace(/([A-Z])/g, ' $1'),
        order: index,
        colSpan: field.type === 'TEXT' ? 12 : 6,
        visible: true,
        readOnly,
        config: field.relationTarget ? { relationEntity: field.relationTarget } : undefined,
      }));
    };

    // Page View
    const viewPage = await this.create({
      entityName,
      pageType: PageType.VIEW,
      name: 'Vue par défaut',
      description: `Page de visualisation pour ${entityName}`,
      isDefault: true,
      order: 0,
      active: true,
      fields: createFields(true),
    });
    pages.push(viewPage);

    // Page Edit
    const editPage = await this.create({
      entityName,
      pageType: PageType.EDIT,
      name: 'Édition par défaut',
      description: `Page d'édition pour ${entityName}`,
      isDefault: true,
      order: 1,
      active: true,
      fields: createFields(false),
    });
    pages.push(editPage);

    return pages;
  }
}
