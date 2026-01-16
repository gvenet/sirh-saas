import { inject } from '@adonisjs/core'
import FileGeneratorService from './file_generator_service.js'
import DatabaseSchemaService from './database_schema_service.js'
import app from '@adonisjs/core/services/app'
import { readdir, rm, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

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
    private databaseSchema: DatabaseSchemaService
  ) {}

  /**
   * Generate a complete entity with model, controller, validator, migration and routes
   */
  async generateEntity(definition: EntityDefinition) {
    const { name, tableName, fields } = definition
    const modelName = this.toPascalCase(name)
    const fileName = this.toSnakeCase(name)

    // 1. Create database table
    await this.databaseSchema.createTable(tableName, fields)

    // 2. Generate model
    const modelContent = this.fileGenerator.generateModel(modelName, tableName, fields)
    await this.writeFile(`app/models/${fileName}.ts`, modelContent)

    // 3. Generate controller
    const controllerContent = this.fileGenerator.generateController(modelName, fileName)
    await this.ensureDir('app/controllers')
    await this.writeFile(`app/controllers/${fileName}_controller.ts`, controllerContent)

    // 4. Generate validator
    const validatorContent = this.fileGenerator.generateValidator(modelName, fields)
    await this.ensureDir('app/validators')
    await this.writeFile(`app/validators/${fileName}_validator.ts`, validatorContent)

    // 5. Update routes
    await this.addRoutes(modelName, fileName)

    return {
      message: `Entity ${modelName} generated successfully`,
      files: [
        `app/models/${fileName}.ts`,
        `app/controllers/${fileName}_controller.ts`,
        `app/validators/${fileName}_validator.ts`,
      ],
    }
  }

  /**
   * List all generated entities
   */
  async listEntities() {
    const modelsPath = app.makePath('app/models')
    const files = await readdir(modelsPath)

    const entities = []
    for (const file of files) {
      if (file.endsWith('.ts') && file !== 'user.ts') {
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
   * Delete an entity and its associated files
   */
  async deleteEntity(name: string, dropTable = true) {
    const fileName = this.toSnakeCase(name)
    const tableName = this.toSnakeCase(name) + 's'

    // Delete files
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

    // Remove routes
    await this.removeRoutes(fileName)

    // Drop table
    if (dropTable) {
      await this.databaseSchema.dropTable(tableName)
    }

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
