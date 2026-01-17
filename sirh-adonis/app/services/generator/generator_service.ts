import { inject } from '@adonisjs/core'
import FileGeneratorService from './file_generator_service.js'
import MigrationRunnerService from './migration_runner_service.js'
import ModelParserService from './model_parser_service.js'
import RelationService from './relation_service.js'
import RoutesService from './routes_service.js'
import EntityPageService from '../entity_page_service.js'
import app from '@adonisjs/core/services/app'
import { rm, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import logger from '@adonisjs/core/services/logger'

export interface FieldDefinition {
  name: string
  type: string
  required?: boolean
  unique?: boolean
  relation?: {
    type: 'many-to-one' | 'one-to-many' | 'many-to-many'
    target: string
    targetTable?: string // Actual table name of the target entity
    inverseSide?: string
  }
}

export interface EntityDefinition {
  name: string
  tableName: string
  fields: FieldDefinition[]
}

@inject()
export default class GeneratorService {
  constructor(
    private fileGenerator: FileGeneratorService,
    private migrationRunner: MigrationRunnerService,
    private modelParser: ModelParserService,
    private relationService: RelationService,
    private routesService: RoutesService,
    private entityPageService: EntityPageService
  ) {}

  /**
   * Normalize fields to ensure consistent format and resolve target table names
   * Handles both formats:
   * - { name, type: 'many-to-many', relationTarget: 'Foo' } (frontend format)
   * - { name, type: 'number', relation: { type: 'many-to-many', target: 'Foo' } } (backend format)
   */
  private normalizeFields(fields: any[]): FieldDefinition[] {
    const relationTypes = ['many-to-one', 'one-to-many', 'many-to-many', 'one-to-one']

    return fields.map((field) => {
      // If already in correct format (has relation object)
      if (field.relation) {
        // Resolve target table name if not already set
        if (!field.relation.targetTable && field.relation.target) {
          field.relation.targetTable = this.modelParser.extractTableName(field.relation.target)
        }
        return field as FieldDefinition
      }

      // If type is a relation type but no relation object, convert it
      if (relationTypes.includes(field.type)) {
        const targetTable = field.relationTarget
          ? this.modelParser.extractTableName(field.relationTarget)
          : undefined

        return {
          name: field.name,
          type: 'number',
          required: field.required,
          unique: field.unique,
          relation: {
            type: field.type as 'many-to-one' | 'one-to-many' | 'many-to-many',
            target: field.relationTarget,
            targetTable,
            inverseSide: field.relationInverse || undefined,
          },
        } as FieldDefinition
      }

      // Regular field
      return field as FieldDefinition
    })
  }

  /**
   * Generate a complete entity with model, controller, validator, migration and routes
   */
  async generateEntity(definition: EntityDefinition) {
    const { name, tableName } = definition
    const fields = this.normalizeFields(definition.fields)
    const modelName = this.toPascalCase(name)
    const fileName = this.toSnakeCase(name)

    logger.info({ name, tableName }, 'Starting entity generation')

    // Check if table already exists
    const tableExists = await this.migrationRunner.tableExists(tableName)
    if (tableExists) {
      throw new Error(
        `Table "${tableName}" already exists. Delete the entity first or use a different name.`
      )
    }

    // Check if model file already exists
    if (this.modelParser.modelExists(name)) {
      throw new Error(
        `Model file "${fileName}.ts" already exists. Delete the entity first or use a different name.`
      )
    }

    // 1. Generate and run migration
    const migrationFileName = await this.migrationRunner.runCreateMigration(tableName, fields)

    // 2. Generate model
    const modelContent = this.fileGenerator.generateModel(modelName, tableName, fields)
    await this.writeFile(`app/models/${fileName}.ts`, modelContent)

    // 3. Update target models with inverse relations
    await this.relationService.updateInverseRelations(modelName, tableName, fields)

    // 4. Generate controller
    const controllerContent = this.fileGenerator.generateController(modelName, fileName)
    await this.ensureDir('app/controllers')
    await this.writeFile(`app/controllers/${fileName}_controller.ts`, controllerContent)

    // 5. Generate validator
    const validatorContent = this.fileGenerator.generateValidator(modelName, fields)
    await this.ensureDir('app/validators')
    await this.writeFile(`app/validators/${fileName}_validator.ts`, validatorContent)

    // 6. Generate default pages
    await this.entityPageService.generateDefaultPages(modelName, fields)

    // 7. Add routes (async to avoid HMR interruption)
    setImmediate(async () => {
      logger.info('Adding routes (async)')
      await this.routesService.addRoutes(modelName, fileName)
    })

    return {
      message: `Entity ${modelName} generated successfully`,
      files: [
        `database/migrations/${migrationFileName}`,
        `app/models/${fileName}.ts`,
        `app/controllers/${fileName}_controller.ts`,
        `app/validators/${fileName}_validator.ts`,
      ],
    }
  }

  /**
   * Get a single entity details by parsing the model file
   */
  async getEntity(name: string): Promise<EntityDefinition | null> {
    return this.modelParser.getEntity(name)
  }

  /**
   * List all generated entities (excludes system models)
   */
  async listEntities() {
    return this.modelParser.listEntities()
  }

  /**
   * Update an existing entity by comparing schemas and generating migrations
   */
  async updateEntity(oldName: string, definition: EntityDefinition) {
    logger.info({ oldName, newName: definition.name }, 'Starting entity update')

    // Normalize fields to handle both frontend and backend formats
    const normalizedDefinition = {
      ...definition,
      fields: this.normalizeFields(definition.fields),
    }

    const oldEntity = await this.modelParser.getEntity(oldName)
    const sameTable = oldEntity?.tableName === normalizedDefinition.tableName

    // If same table and same name, update files and generate migration for schema changes
    if (sameTable && oldName.toLowerCase() === normalizedDefinition.name.toLowerCase()) {
      return this.updateEntityInPlace(oldEntity, normalizedDefinition)
    }

    // Different table or name - delete old and create new
    await this.deleteEntity(oldName, !sameTable)
    await new Promise((resolve) => setTimeout(resolve, 500))
    return this.generateEntity(normalizedDefinition)
  }

  private async updateEntityInPlace(
    oldEntity: EntityDefinition | null,
    definition: EntityDefinition
  ) {
    const modelName = this.toPascalCase(definition.name)
    const fileName = this.toSnakeCase(definition.name)

    // Compare fields to detect changes
    const oldFields = oldEntity?.fields || []
    const { addedFields, removedFields } = this.modelParser.compareFields(
      oldFields,
      definition.fields
    )

    logger.info(
      { addedFields: addedFields.length, removedFields: removedFields.length },
      'Schema changes detected'
    )

    // Generate and run migration if there are schema changes
    const migrationFileName = await this.migrationRunner.runAlterMigration(
      definition.tableName,
      addedFields,
      removedFields
    )

    // Delete old files (but not routes)
    await this.deleteEntityFiles(fileName)

    // Generate model
    const modelContent = this.fileGenerator.generateModel(
      modelName,
      definition.tableName,
      definition.fields
    )
    await this.writeFile(`app/models/${fileName}.ts`, modelContent)

    // Update inverse relations for new relations
    await this.relationService.updateInverseRelations(modelName, definition.tableName, addedFields)

    // Generate controller
    const controllerContent = this.fileGenerator.generateController(modelName, fileName)
    await this.writeFile(`app/controllers/${fileName}_controller.ts`, controllerContent)

    // Generate validator
    const validatorContent = this.fileGenerator.generateValidator(modelName, definition.fields)
    await this.writeFile(`app/validators/${fileName}_validator.ts`, validatorContent)

    // Regenerate pages
    await this.entityPageService.generateDefaultPages(modelName, definition.fields)

    logger.info({ name: modelName, migrationFileName }, 'Entity updated successfully')

    const files = [
      `app/models/${fileName}.ts`,
      `app/controllers/${fileName}_controller.ts`,
      `app/validators/${fileName}_validator.ts`,
    ]
    if (migrationFileName) {
      files.unshift(`database/migrations/${migrationFileName}`)
    }

    return {
      message: `Entity ${modelName} updated successfully${migrationFileName ? ' with schema migration' : ''}`,
      files,
    }
  }

  /**
   * Delete an entity and its associated files
   */
  async deleteEntity(name: string, dropTable = true) {
    logger.info({ name, dropTable }, 'Starting entity deletion')
    const fileName = this.toSnakeCase(name)
    const modelName = this.toPascalCase(name)

    // Extract tableName from model file before deleting
    const tableName = this.modelParser.extractTableName(name)

    // Delete files
    await this.deleteEntityFiles(fileName)

    // Drop table via migration
    if (dropTable) {
      await this.migrationRunner.runDropMigration(tableName)
    }

    // Remove entity pages
    await this.entityPageService.removeByEntity(modelName)

    logger.info({ name }, 'Entity deleted successfully')

    // Remove routes (async to avoid HMR interruption)
    setImmediate(async () => {
      logger.info('Removing routes (async)')
      await this.routesService.removeRoutes(fileName)
    })

    return { message: `Entity ${name} deleted successfully` }
  }

  private async deleteEntityFiles(fileName: string) {
    const filesToDelete = [
      `app/models/${fileName}.ts`,
      `app/controllers/${fileName}_controller.ts`,
      `app/validators/${fileName}_validator.ts`,
    ]

    for (const file of filesToDelete) {
      const fullPath = app.makePath(file)
      if (existsSync(fullPath)) {
        logger.info({ file: fullPath }, 'Deleting file')
        await rm(fullPath)
      }
    }
  }

  private async writeFile(relativePath: string, content: string) {
    const fullPath = app.makePath(relativePath)
    await writeFile(fullPath, content)
  }

  private async ensureDir(relativePath: string) {
    const fullPath = app.makePath(relativePath)
    if (!existsSync(fullPath)) {
      await mkdir(fullPath, { recursive: true })
    }
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
  }
}
