import { Injectable, Logger } from '@nestjs/common';
import { CreateEntityDto } from './dto/create-entity.dto';
import { FieldType, isRelationType } from './dto/field.dto';
import { EntityPageService } from '../entity-page/entity-page.service';
import {
  DatabaseSchemaService,
  FileGeneratorService,
  FileWriterService,
  FileToWrite,
  RelationService,
  AppModuleService,
  EntityParserService,
} from './services';
import * as path from 'path';

@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name);
  private readonly entitiesPath = path.join(process.cwd(), 'src', 'entities');

  constructor(
    private readonly entityPageService: EntityPageService,
    private readonly databaseSchemaService: DatabaseSchemaService,
    private readonly fileGeneratorService: FileGeneratorService,
    private readonly fileWriterService: FileWriterService,
    private readonly relationService: RelationService,
    private readonly appModuleService: AppModuleService,
    private readonly entityParserService: EntityParserService,
  ) {}

  async generateEntity(createEntityDto: CreateEntityDto) {
    this.logger.warn('generateEntity');
    const { name, tableName, fields } = createEntityDto;
    const entityName = this.entityParserService.capitalize(name);
    const moduleName = name.toLowerCase();
    const modulePath = path.join(this.entitiesPath, moduleName);

    // 1. Synchroniser le schéma de base de données AVANT de créer les fichiers
    await this.databaseSchemaService.syncDatabaseSchema(tableName, fields);

    // 2. Générer tout le contenu des fichiers en mémoire
    const entityContent = this.fileGeneratorService.generateEntityFile(entityName, tableName, fields);
    const { createDto, updateDto } = this.fileGeneratorService.generateDtoFiles(entityName, fields);
    const serviceContent = this.fileGeneratorService.generateServiceFile(entityName, moduleName, fields);
    const controllerContent = this.fileGeneratorService.generateControllerFile(entityName, moduleName);
    const moduleContent = this.fileGeneratorService.generateModuleFile(entityName, moduleName);

    // 3. Préparer la liste des fichiers à écrire (tous au même niveau, pas de sous-dossier dto)
    const filesToWrite: FileToWrite[] = [
      { path: path.join(modulePath, `${moduleName}.entity.ts`), content: entityContent },
      { path: path.join(modulePath, `create-${moduleName}.dto.ts`), content: createDto },
      { path: path.join(modulePath, `update-${moduleName}.dto.ts`), content: updateDto },
      { path: path.join(modulePath, `${moduleName}.service.ts`), content: serviceContent },
      { path: path.join(modulePath, `${moduleName}.controller.ts`), content: controllerContent },
      { path: path.join(modulePath, `${moduleName}.module.ts`), content: moduleContent },
    ];

    // 4. Ajouter les relations inverses (collecter les modifications)
    const inverseRelationFiles = await this.relationService.collectInverseRelationFiles(entityName, fields);
    filesToWrite.push(...inverseRelationFiles);

    // 5. Préparer la modification de app.module.ts
    const appModuleUpdate = await this.appModuleService.prepareAddModule(entityName, moduleName);
    if (appModuleUpdate) {
      filesToWrite.push(appModuleUpdate);
    }

    // 6. Écrire TOUS les fichiers d'un coup
    this.fileWriterService.writeAllFiles(filesToWrite);

    // 7. Générer les pages par défaut (en base de données, pas de fichiers)
    await this.entityPageService.generateDefaultPages(entityName, fields);

    return {
      message: `Entity ${entityName} generated successfully`,
      path: modulePath,
      files: [
        `${moduleName}.entity.ts`,
        `create-${moduleName}.dto.ts`,
        `update-${moduleName}.dto.ts`,
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
    const oldSchema = await this.entityParserService.getEntitySchema(name);
    const oldRelations = oldSchema.fields.filter(f => isRelationType(f.type as FieldType));
    const oldFields = oldSchema.fields;

    // Supprimer l'ancienne entité (sans supprimer la table en base pour conserver les données)
    await this.deleteEntity(name, false, false);

    // Recréer avec les nouvelles données
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

    if (!this.fileWriterService.exists(entityPath)) {
      throw new Error(`Entity ${name} not found`);
    }

    let tableName: string | null = null;
    let relationTables: string[] = [];
    let schema: any = null;

    try {
      schema = await this.entityParserService.getEntitySchema(name);
      tableName = schema.tableName;

      const manyToManyRelations = schema.fields.filter(f => f.type === 'many-to-many');
      relationTables = manyToManyRelations.map(rel => `${schema.tableName}_${rel.name}`);
    } catch (e) {
      this.logger.warn(`Could not get entity schema: ${e.message}`);
    }

    // Collecter les fichiers à modifier (relations inverses) - SANS app.module.ts
    const filesToWrite: FileToWrite[] = [];

    if (schema) {
      const cleanupFiles = await this.relationService.collectCleanupFiles(
        entityName,
        schema.fields,
        () => this.entityParserService.listEntities(),
      );
      filesToWrite.push(...cleanupFiles);
    }

    // Préparer la modification de app.module.ts
    if (removeFromAppModule) {
      const appModuleUpdate = await this.appModuleService.prepareRemoveModule(entityName, moduleName);
      if (appModuleUpdate) {
        filesToWrite.push(appModuleUpdate);
      }
    }

    // Supprimer le dossier ET écrire les modifications en une seule opération
    this.fileWriterService.deleteAndWriteAll([entityPath], filesToWrite);

    // Supprimer la table et les tables de jonction en base
    if (dropTable && tableName) {
      await this.databaseSchemaService.dropTableFromDatabase(tableName, relationTables);
    }

    // Supprimer les pages associées
    await this.entityPageService.removeByEntity(entityName);

    return {
      message: `Entity ${name} deleted successfully`,
    };
  }
}
