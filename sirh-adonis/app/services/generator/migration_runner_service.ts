import app from '@adonisjs/core/services/app'
import { execSync } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import logger from '@adonisjs/core/services/logger'
import FileGeneratorService from './file_generator_service.js'
import DatabaseSchemaService from './database_schema_service.js'
import type { FieldDefinition } from './generator_service.js'
import { inject } from '@adonisjs/core'

@inject()
export default class MigrationRunnerService {
  constructor(
    private fileGenerator: FileGeneratorService,
    private databaseSchema: DatabaseSchemaService
  ) {}

  /**
   * Generate and run a create table migration
   */
  async runCreateMigration(tableName: string, fields: FieldDefinition[]): Promise<string> {
    const migrationContent = this.fileGenerator.generateMigration(tableName, fields)
    const migrationFileName = await this.saveMigration(`create_${tableName}_table`, migrationContent)

    await this.runMigrations()
    return migrationFileName
  }

  /**
   * Generate and run an alter table migration
   */
  async runAlterMigration(
    tableName: string,
    addedFields: FieldDefinition[],
    removedFields: FieldDefinition[]
  ): Promise<string | null> {
    if (addedFields.length === 0 && removedFields.length === 0) {
      return null
    }

    const migrationContent = this.fileGenerator.generateAlterMigration(
      tableName,
      addedFields,
      removedFields,
      tableName
    )

    const migrationFileName = await this.saveMigration(`alter_${tableName}_table`, migrationContent)
    await this.runMigrations()
    return migrationFileName
  }

  /**
   * Generate and run a drop table migration
   */
  async runDropMigration(tableName: string): Promise<void> {
    const migrationContent = this.fileGenerator.generateDropMigration(tableName)
    const migrationFileName = await this.saveMigration(`drop_${tableName}_table`, migrationContent)

    try {
      await this.runMigrations()
    } catch (error) {
      logger.error({ error, migrationFileName }, 'Drop migration failed, falling back to direct drop')
      await this.databaseSchema.dropTable(tableName)
    }
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    return this.databaseSchema.tableExists(tableName)
  }

  private async saveMigration(name: string, content: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    const fileName = `${timestamp}_${name}.ts`

    await this.ensureDir('database/migrations')
    const fullPath = app.makePath(`database/migrations/${fileName}`)
    await writeFile(fullPath, content)

    logger.info({ fileName }, 'Migration file created')
    return fileName
  }

  private async runMigrations(): Promise<void> {
    logger.info('Running migrations: node ace migration:run')
    try {
      const result = execSync('node ace migration:run', {
        cwd: app.appRoot.pathname,
        encoding: 'utf-8',
      })
      logger.info({ result: result.trim() }, 'Migration completed successfully')
    } catch (error) {
      logger.error({ error }, 'Migration failed')
      throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async ensureDir(relativePath: string) {
    const fullPath = app.makePath(relativePath)
    if (!existsSync(fullPath)) {
      await mkdir(fullPath, { recursive: true })
    }
  }
}
