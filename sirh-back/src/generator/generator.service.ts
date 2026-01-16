import { Injectable, Logger } from '@nestjs/common';
import { CreateEntityDto } from './dto/create-entity.dto';
import { FieldType, isRelationType } from './dto/field.dto';
import { EntityPageService } from '../entity-page/entity-page.service';
import {
  DatabaseSchemaService,
  FileGeneratorService,
  RelationService,
  AppModuleService,
  EntityParserService,
} from './services';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name);
  private readonly entitiesPath = path.join(process.cwd(), 'src', 'entities');

  constructor(
    private readonly entityPageService: EntityPageService,
    private readonly databaseSchemaService: DatabaseSchemaService,
    private readonly fileGeneratorService: FileGeneratorService,
    private readonly relationService: RelationService,
    private readonly appModuleService: AppModuleService,
    private readonly entityParserService: EntityParserService,
  ) {}

  async generateEntity(createEntityDto: CreateEntityDto) {
    this.logger.warn('generateEntity');
    const { name, tableName, fields } = createEntityDto;
    const entityName = this.entityParserService.capitalize(name);
    const moduleName = name.toLowerCase();

    // Synchroniser le schéma de base de données AVANT de créer les fichiers
    await this.databaseSchemaService.syncDatabaseSchema(tableName, fields);

    // S'assurer que le dossier entities existe
    if (!fs.existsSync(this.entitiesPath)) {
      fs.mkdirSync(this.entitiesPath, { recursive: true });
    }

    // Créer le dossier du module dans src/entities
    const modulePath = path.join(this.entitiesPath, moduleName);
    if (!fs.existsSync(modulePath)) {
      fs.mkdirSync(modulePath, { recursive: true });
    }

    // Créer le dossier dto
    const dtoPath = path.join(modulePath, 'dto');
    if (!fs.existsSync(dtoPath)) {
      fs.mkdirSync(dtoPath, { recursive: true });
    }

    // Générer tous les fichiers
    await this.fileGeneratorService.generateEntityFile(modulePath, entityName, tableName, fields);
    await this.fileGeneratorService.generateDtoFiles(modulePath, entityName, fields);
    await this.fileGeneratorService.generateServiceFile(modulePath, entityName, moduleName, fields);
    await this.fileGeneratorService.generateControllerFile(modulePath, entityName, moduleName);
    await this.fileGeneratorService.generateModuleFile(modulePath, entityName, moduleName);

    // Ajouter les relations inverses sur les entités cibles
    await this.relationService.addInverseRelationsToTargetEntities(entityName, fields);

    // Mettre à jour app.module.ts
    await this.appModuleService.updateAppModule(entityName, moduleName);

    // Générer les pages par défaut (view et edit)
    await this.entityPageService.generateDefaultPages(entityName, fields);

    return {
      message: `Entity ${entityName} generated successfully`,
      path: modulePath,
      files: [
        `${moduleName}.entity.ts`,
        `dto/create-${moduleName}.dto.ts`,
        `dto/update-${moduleName}.dto.ts`,
        `${moduleName}.service.ts`,
        `${moduleName}.controller.ts`,
        `${moduleName}.module.ts`,
      ],
    };
  }

  async listEntities() {
    this.logger.warn('listEntities');
    return this.entityParserService.listEntities();
  }

  async getEntitySchema(name: string) {
    this.logger.warn('getEntitySchema');
    return this.entityParserService.getEntitySchema(name);
  }

  async updateEntity(name: string, updateEntityDto: CreateEntityDto) {
    this.logger.warn('updateEntity');
    // Récupérer les anciennes relations avant suppression
    const oldSchema = await this.entityParserService.getEntitySchema(name);
    const oldRelations = oldSchema.fields.filter(f => isRelationType(f.type as FieldType));
    const oldFields = oldSchema.fields;

    // Supprimer l'ancienne entité (sans supprimer la table en base pour conserver les données)
    await this.deleteEntity(name, false, false);

    // Recréer avec les nouvelles données (syncDatabaseSchema sera appelé dans generateEntity)
    const result = await this.generateEntity(updateEntityDto);

    // Nettoyer les colonnes supprimées de la base de données
    await this.relationService.cleanupRemovedColumns(oldSchema.tableName, oldFields, updateEntityDto.fields);

    // Nettoyer les relations inverses orphelines
    const newRelations = updateEntityDto.fields.filter(f => isRelationType(f.type));
    await this.relationService.cleanupOrphanedInverseRelations(name, oldRelations, newRelations);

    // Supprimer les tables de jonction ManyToMany qui n'existent plus
    await this.relationService.cleanupOrphanedJunctionTables(oldSchema.tableName, oldRelations, newRelations);

    return result;
  }

  async deleteEntity(name: string, removeFromAppModule: boolean = true, dropTable: boolean = true) {
    this.logger.warn('deleteEntity');
    const moduleName = name.toLowerCase();
    const entityName = this.entityParserService.capitalize(name);
    const entityPath = path.join(this.entitiesPath, moduleName);

    if (!fs.existsSync(entityPath)) {
      throw new Error(`Entity ${name} not found`);
    }

    // Récupérer le nom de la table et les relations avant de supprimer les fichiers
    let tableName: string | null = null;
    let relationTables: string[] = [];
    let schema: any = null;

    try {
      schema = await this.entityParserService.getEntitySchema(name);
      tableName = schema.tableName;

      // Récupérer les tables de jonction ManyToMany
      const manyToManyRelations = schema.fields.filter(f => f.type === 'many-to-many');
      relationTables = manyToManyRelations.map(rel => `${schema.tableName}_${rel.name}`);
    } catch (e) {
      this.logger.warn(`Could not get entity schema: ${e.message}`);
    }

    // Nettoyer les relations inverses dans les autres entités AVANT de supprimer les fichiers
    if (schema) {
      await this.relationService.cleanupAllInverseRelationsOnDelete(
        entityName,
        schema.fields,
        () => this.entityParserService.listEntities(),
      );
    }

    // Supprimer le dossier de l'entité
    fs.rmSync(entityPath, { recursive: true, force: true });

    // Retirer du app.module.ts si demandé
    if (removeFromAppModule) {
      await this.appModuleService.removeFromAppModule(entityName, moduleName);
    }

    // Supprimer la table et les tables de jonction en base
    if (dropTable && tableName) {
      await this.databaseSchemaService.dropTableFromDatabase(tableName, relationTables);
    }

    // Supprimer les pages associées à cette entité
    await this.entityPageService.removeByEntity(entityName);

    return {
      message: `Entity ${name} deleted successfully`,
    };
  }
}
