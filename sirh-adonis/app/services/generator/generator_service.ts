import { inject } from '@adonisjs/core'
import FileGeneratorService from './file_generator_service.js'
import DatabaseSchemaService from './database_schema_service.js'
import EntityPageService from '../entity_page_service.js'
import app from '@adonisjs/core/services/app'
import { readdir, rm, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import logger from '@adonisjs/core/services/logger'
import { execSync } from 'node:child_process'

export interface FieldDefinition {
  name: string
  type: string
  required?: boolean
  unique?: boolean
  relation?: {
    type: 'many-to-one' | 'one-to-many' | 'many-to-many'
    target: string
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
    private databaseSchema: DatabaseSchemaService,
    private entityPageService: EntityPageService
  ) {}

  /**
   * Generate a complete entity with model, controller, validator, migration and routes
   */
  async generateEntity(definition: EntityDefinition) {
    const { name, tableName, fields } = definition
    const modelName = this.toPascalCase(name)
    const fileName = this.toSnakeCase(name)

    logger.info({ name, tableName }, 'Starting entity generation')

    // Check if table already exists
    const tableExists = await this.databaseSchema.tableExists(tableName)
    if (tableExists) {
      throw new Error(`Table "${tableName}" already exists. Delete the entity first or use a different name.`)
    }

    // Check if model file already exists
    const modelPath = app.makePath(`app/models/${fileName}.ts`)
    if (existsSync(modelPath)) {
      throw new Error(`Model file "${fileName}.ts" already exists. Delete the entity first or use a different name.`)
    }

    // 1. Generate migration file
    const migrationName = `create_${tableName}_table`
    const migrationContent = this.fileGenerator.generateMigration(tableName, fields)
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    const migrationFileName = `${timestamp}_${migrationName}.ts`
    await this.ensureDir('database/migrations')
    await this.writeFile(`database/migrations/${migrationFileName}`, migrationContent)
    logger.info({ migrationFileName }, 'Migration file created')

    // 2. Run migration
    try {
      logger.info({ migrationFileName, tableName }, '🚀 Running migration: node ace migration:run')
      const result = execSync('node ace migration:run', {
        cwd: app.appRoot.pathname,
        encoding: 'utf-8',
      })
      logger.info({ result: result.trim() }, '✅ Migration completed successfully')
    } catch (error) {
      logger.error({ error, migrationFileName }, '❌ Migration failed')
      throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 3. Generate model
    const modelContent = this.fileGenerator.generateModel(modelName, tableName, fields)
    await this.writeFile(`app/models/${fileName}.ts`, modelContent)

    // 4. Generate controller
    const controllerContent = this.fileGenerator.generateController(modelName, fileName)
    await this.ensureDir('app/controllers')
    await this.writeFile(`app/controllers/${fileName}_controller.ts`, controllerContent)

    // 5. Generate validator
    const validatorContent = this.fileGenerator.generateValidator(modelName, fields)
    await this.ensureDir('app/validators')
    await this.writeFile(`app/validators/${fileName}_validator.ts`, validatorContent)

    // 6. Update routes (do this last before response as it triggers HMR)
    // Generate default pages BEFORE routes to avoid HMR interruption
    await this.entityPageService.generateDefaultPages(modelName, fields)

    // Routes update triggers HMR, so do it asynchronously
    setImmediate(async () => {
      logger.info('Adding routes (async)')
      await this.addRoutes(modelName, fileName)
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
    const fileName = this.toSnakeCase(name)
    const modelPath = app.makePath(`app/models/${fileName}.ts`)

    if (!existsSync(modelPath)) {
      return null
    }

    const { readFileSync } = await import('node:fs')
    const modelContent = readFileSync(modelPath, 'utf-8')

    // Extract tableName
    const tableMatch = modelContent.match(/static\s+table\s*=\s*['"]([^'"]+)['"]/)
    const tableName = tableMatch ? tableMatch[1] : this.toSnakeCase(name) + 's'

    // Extract fields from @column() declarations
    const fields: FieldDefinition[] = []

    // Match @column() declarations followed by declare fieldName: type
    const columnRegex = /@column\([^)]*\)\s*declare\s+(\w+):\s*([^|\n]+)/g
    let match
    while ((match = columnRegex.exec(modelContent)) !== null) {
      const fieldName = match[1]
      const tsType = match[2].trim()

      // Skip system fields
      if (['id', 'createdAt', 'updatedAt'].includes(fieldName)) continue

      // Map TypeScript types to field types
      let fieldType = 'string'
      if (tsType.includes('number')) fieldType = 'number'
      else if (tsType.includes('boolean')) fieldType = 'boolean'
      else if (tsType.includes('DateTime')) fieldType = 'datetime'
      else if (tsType.includes('Date')) fieldType = 'date'
      else if (tsType.includes('Record')) fieldType = 'json'

      // Check if it's a foreign key (ends with Id)
      if (fieldName.endsWith('Id')) {
        const relationName = fieldName.replace(/Id$/, '')
        // Check if there's a corresponding @belongsTo relation
        const belongsToRegex = new RegExp(`@belongsTo\\([^)]*\\)\\s*declare\\s+${relationName}:`)
        if (belongsToRegex.test(modelContent)) {
          // Skip the FK field, we'll add it as a relation
          continue
        }
      }

      fields.push({
        name: fieldName,
        type: fieldType,
        required: !tsType.includes('null'),
      })
    }

    // Extract relations
    const belongsToRegex = /@belongsTo\(\(\)\s*=>\s*(\w+)\)\s*declare\s+(\w+):/g
    while ((match = belongsToRegex.exec(modelContent)) !== null) {
      const targetModel = match[1]
      const fieldName = match[2]
      fields.push({
        name: fieldName,
        type: 'number',
        relation: {
          type: 'many-to-one',
          target: targetModel,
        },
      })
    }

    const hasManyRegex = /@hasMany\(\(\)\s*=>\s*(\w+)\)\s*declare\s+(\w+):/g
    while ((match = hasManyRegex.exec(modelContent)) !== null) {
      const targetModel = match[1]
      const fieldName = match[2]
      fields.push({
        name: fieldName,
        type: 'string',
        relation: {
          type: 'one-to-many',
          target: targetModel,
        },
      })
    }

    return {
      name: this.toPascalCase(name),
      tableName,
      fields,
    }
  }

  /**
   * List all generated entities (excludes system models)
   */
  async listEntities() {
    const modelsPath = app.makePath('app/models')
    const files = await readdir(modelsPath)

    // System models that should not be listed
    const systemModels = ['user.ts', 'entity_page.ts', 'page_field.ts']

    const entities = []
    for (const file of files) {
      if (file.endsWith('.ts') && !systemModels.includes(file)) {
        const name = file.replace('.ts', '')
        entities.push({
          name: this.toPascalCase(name),
          fileName: name,
        })
      }
    }

    return entities
  }

  /**
   * Update an existing entity by deleting and recreating it
   */
  async updateEntity(oldName: string, definition: EntityDefinition) {
    logger.info({ oldName, newName: definition.name }, 'Starting entity update')

    // Delete old entity (but don't drop table if tableName is the same)
    const oldEntity = await this.getEntity(oldName)
    const sameTable = oldEntity?.tableName === definition.tableName

    // If same table and same name, just update files without touching routes
    if (sameTable && oldName.toLowerCase() === definition.name.toLowerCase()) {
      const modelName = this.toPascalCase(definition.name)
      const fileName = this.toSnakeCase(definition.name)

      // Delete old files (but not routes)
      const filesToDelete = [
        `app/models/${fileName}.ts`,
        `app/controllers/${fileName}_controller.ts`,
        `app/validators/${fileName}_validator.ts`,
      ]

      for (const file of filesToDelete) {
        const fullPath = app.makePath(file)
        if (existsSync(fullPath)) {
          await rm(fullPath)
        }
      }

      // Generate model
      const modelContent = this.fileGenerator.generateModel(modelName, definition.tableName, definition.fields)
      await this.writeFile(`app/models/${fileName}.ts`, modelContent)

      // Generate controller
      const controllerContent = this.fileGenerator.generateController(modelName, fileName)
      await this.writeFile(`app/controllers/${fileName}_controller.ts`, controllerContent)

      // Generate validator
      const validatorContent = this.fileGenerator.generateValidator(modelName, definition.fields)
      await this.writeFile(`app/validators/${fileName}_validator.ts`, validatorContent)

      // Regenerate pages
      await this.entityPageService.generateDefaultPages(modelName, definition.fields)

      logger.info({ name: modelName }, 'Entity updated successfully (files only)')

      return {
        message: `Entity ${modelName} updated successfully`,
        files: [
          `app/models/${fileName}.ts`,
          `app/controllers/${fileName}_controller.ts`,
          `app/validators/${fileName}_validator.ts`,
        ],
      }
    }

    // Different table or name - delete old and create new
    await this.deleteEntity(oldName, !sameTable)

    // Wait for HMR to settle
    await new Promise((resolve) => setTimeout(resolve, 500))

    return this.generateEntity(definition)
  }

  /**
   * Delete an entity and its associated files
   */
  async deleteEntity(name: string, dropTable = true) {
    logger.info({ name, dropTable }, 'Starting entity deletion')
    const fileName = this.toSnakeCase(name)
    const modelPath = app.makePath(`app/models/${fileName}.ts`)

    // Extract tableName from model file before deleting
    let tableName = this.toSnakeCase(name) + 's' // default fallback
    if (existsSync(modelPath)) {
      const { readFileSync } = await import('node:fs')
      const modelContent = readFileSync(modelPath, 'utf-8')
      const tableMatch = modelContent.match(/static\s+table\s*=\s*['"]([^'"]+)['"]/)
      if (tableMatch) {
        tableName = tableMatch[1]
        logger.info({ tableName }, 'Extracted tableName from model')
      }
    }

    // Delete files
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

    // Drop table via migration
    if (dropTable) {
      logger.info({ tableName }, 'Creating drop migration')
      const migrationContent = this.fileGenerator.generateDropMigration(tableName)
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
      const migrationFileName = `${timestamp}_drop_${tableName}_table.ts`
      await this.ensureDir('database/migrations')
      await this.writeFile(`database/migrations/${migrationFileName}`, migrationContent)

      try {
        logger.info({ migrationFileName, tableName }, '🚀 Running drop migration: node ace migration:run')
        const result = execSync('node ace migration:run', {
          cwd: app.appRoot.pathname,
          encoding: 'utf-8',
        })
        logger.info({ result: result.trim() }, '✅ Drop migration completed successfully')
      } catch (error) {
        logger.error({ error, migrationFileName }, '❌ Drop migration failed, falling back to direct drop')
        // Fallback to direct drop if migration fails
        await this.databaseSchema.dropTable(tableName)
      }
    }

    // Remove entity pages
    logger.info('Removing entity pages')
    const modelName = this.toPascalCase(name)
    await this.entityPageService.removeByEntity(modelName)

    logger.info({ name }, 'Entity deleted successfully')

    // Remove routes LAST (triggers HMR restart which kills the connection)
    // Use setImmediate to let the response be sent first
    setImmediate(async () => {
      logger.info('Removing routes (async)')
      await this.removeRoutes(fileName)
    })

    return { message: `Entity ${name} deleted successfully` }
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

  private async addRoutes(modelName: string, fileName: string) {
    const routesPath = app.makePath('start/routes.ts')
    const { readFile, writeFile } = await import('node:fs/promises')
    let content = await readFile(routesPath, 'utf-8')

    const importStatement = `const ${modelName}Controller = () => import('#controllers/${fileName}_controller')\n`
    const routeGroup = `
// ${modelName} routes
router.group(() => {
  router.get('/', [${modelName}Controller, 'index'])
  router.get('/:id', [${modelName}Controller, 'show'])
  router.post('/', [${modelName}Controller, 'store'])
  router.put('/:id', [${modelName}Controller, 'update'])
  router.delete('/:id', [${modelName}Controller, 'destroy'])
}).prefix('/${fileName}s')
`

    // Add import after the router import
    if (!content.includes(importStatement)) {
      content = content.replace(
        "import router from '@adonisjs/core/services/router'",
        `import router from '@adonisjs/core/services/router'\n${importStatement}`
      )
    }

    // Add routes at the end
    if (!content.includes(`// ${modelName} routes`)) {
      content += routeGroup
    }

    await writeFile(routesPath, content)
  }

  private async removeRoutes(fileName: string) {
    const routesPath = app.makePath('start/routes.ts')
    const { readFile, writeFile } = await import('node:fs/promises')
    let content = await readFile(routesPath, 'utf-8')

    const modelName = this.toPascalCase(fileName)

    // Remove import
    const importRegex = new RegExp(`const ${modelName}Controller = \\(\\) => import\\('#controllers/${fileName}_controller'\\)\\n`, 'g')
    content = content.replace(importRegex, '')

    // Remove route group
    const routeRegex = new RegExp(`\\n// ${modelName} routes[\\s\\S]*?\\.prefix\\('/${fileName}s'\\)\\n`, 'g')
    content = content.replace(routeRegex, '')

    await writeFile(routesPath, content)
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
