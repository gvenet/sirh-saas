import db from '@adonisjs/lucid/services/db'
import type { FieldDefinition } from './generator_service.js'

export default class DatabaseSchemaService {
  /**
   * Create a table in the database
   */
  async createTable(tableName: string, fields: FieldDefinition[]) {
    const exists = await this.tableExists(tableName)
    if (exists) {
      console.log(`Table ${tableName} already exists, skipping creation`)
      return
    }

    const columns = fields
      .filter((f) => !f.relation || f.relation.type === 'many-to-one')
      .map((field) => this.getColumnDefinition(field))
      .join(',\n        ')

    const columnsPart = columns ? `${columns},` : ''

    const sql = `
      CREATE TABLE "${tableName}" (
        "id" SERIAL PRIMARY KEY,
        ${columnsPart}
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `

    await db.rawQuery(sql)
    console.log(`Table ${tableName} created successfully`)

    // Create indexes for unique fields
    for (const field of fields) {
      if (field.unique) {
        const columnName = field.relation?.type === 'many-to-one' ? `${field.name}_id` : field.name
        await db.rawQuery(
          `CREATE UNIQUE INDEX "idx_${tableName}_${columnName}" ON "${tableName}" ("${this.toSnakeCase(columnName)}")`
        )
      }
    }

    // Create foreign key constraints
    for (const field of fields) {
      if (field.relation?.type === 'many-to-one') {
        const targetTable = field.relation.targetTable || this.toSnakeCase(field.relation.target) + 's'
        const columnName = `${this.toSnakeCase(field.name)}_id`
        await db.rawQuery(`
          ALTER TABLE "${tableName}"
          ADD CONSTRAINT "fk_${tableName}_${columnName}"
          FOREIGN KEY ("${columnName}")
          REFERENCES "${targetTable}"("id")
          ON DELETE SET NULL
        `)
      }
    }

    // Create junction tables for many-to-many
    for (const field of fields) {
      if (field.relation?.type === 'many-to-many') {
        await this.createJunctionTable(tableName, field)
      }
    }
  }

  /**
   * Drop a table from the database
   */
  async dropTable(tableName: string, junctionTables: string[] = []) {
    // Drop junction tables first
    for (const junctionTable of junctionTables) {
      await db.rawQuery(`DROP TABLE IF EXISTS "${junctionTable}" CASCADE`)
    }

    await db.rawQuery(`DROP TABLE IF EXISTS "${tableName}" CASCADE`)
    console.log(`Table ${tableName} dropped`)
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    const result = await db.rawQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = ?
      )
    `, [tableName])

    return result.rows[0]?.exists || false
  }

  private async createJunctionTable(tableName: string, field: FieldDefinition) {
    const targetTable = field.relation!.targetTable || this.toSnakeCase(field.relation!.target) + 's'
    // Format: {relationName}_{table1}_{table2}
    const junctionTable = `${field.name}_${tableName}_${targetTable}`
    const singularSource = tableName.replace(/s$/, '')
    const singularTarget = targetTable.replace(/s$/, '')

    const sql = `
      CREATE TABLE IF NOT EXISTS "${junctionTable}" (
        "${singularSource}_id" INTEGER NOT NULL REFERENCES "${tableName}"("id") ON DELETE CASCADE,
        "${singularTarget}_id" INTEGER NOT NULL REFERENCES "${targetTable}"("id") ON DELETE CASCADE,
        PRIMARY KEY ("${singularSource}_id", "${singularTarget}_id")
      )
    `

    await db.rawQuery(sql)
    console.log(`Junction table ${junctionTable} created`)
  }

  private getColumnDefinition(field: FieldDefinition): string {
    let columnName = this.toSnakeCase(field.name)
    let columnType: string

    if (field.relation?.type === 'many-to-one') {
      columnName = `${columnName}_id`
      columnType = 'INTEGER'
    } else {
      columnType = this.getSqlType(field.type)
    }

    const nullable = field.required === false ? '' : ' NOT NULL'
    const unique = field.unique ? ' UNIQUE' : ''

    return `"${columnName}" ${columnType}${nullable}${unique}`
  }

  private getSqlType(type: string): string {
    switch (type) {
      case 'string':
        return 'VARCHAR(255)'
      case 'text':
        return 'TEXT'
      case 'number':
      case 'integer':
        return 'INTEGER'
      case 'float':
        return 'DECIMAL(10, 2)'
      case 'boolean':
        return 'BOOLEAN DEFAULT FALSE'
      case 'date':
        return 'DATE'
      case 'datetime':
        return 'TIMESTAMP WITH TIME ZONE'
      case 'json':
        return 'JSONB'
      default:
        return 'VARCHAR(255)'
    }
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
  }
}
