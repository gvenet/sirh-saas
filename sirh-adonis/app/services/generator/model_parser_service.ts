import app from '@adonisjs/core/services/app'
import { existsSync, readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import type { FieldDefinition, EntityDefinition } from './generator_service.js'

export default class ModelParserService {
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

  /**
   * Parse a model file to extract entity definition
   */
  async getEntity(name: string): Promise<EntityDefinition | null> {
    const fileName = this.toSnakeCase(name)
    const modelPath = app.makePath(`app/models/${fileName}.ts`)

    if (!existsSync(modelPath)) {
      return null
    }

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

    // Extract many-to-many relations
    const manyToManyRegex = /@manyToMany\(\(\)\s*=>\s*(\w+)[^)]*\)\s*declare\s+(\w+):/g
    while ((match = manyToManyRegex.exec(modelContent)) !== null) {
      const targetModel = match[1]
      const fieldName = match[2]
      fields.push({
        name: fieldName,
        type: 'string',
        relation: {
          type: 'many-to-many',
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
    const systemModels = ['user.ts', 'entity_page.ts', 'page_field.ts', 'application.ts', 'menu_item.ts', 'menu_page.ts']

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
   * Extract tableName from a model file
   */
  extractTableName(name: string): string {
    const fileName = this.toSnakeCase(name)
    const modelPath = app.makePath(`app/models/${fileName}.ts`)
    let tableName = this.toSnakeCase(name) + 's' // default fallback

    if (existsSync(modelPath)) {
      const modelContent = readFileSync(modelPath, 'utf-8')
      const tableMatch = modelContent.match(/static\s+table\s*=\s*['"]([^'"]+)['"]/)
      if (tableMatch) {
        tableName = tableMatch[1]
      }
    }

    return tableName
  }

  /**
   * Compare old and new fields to detect added and removed fields
   */
  compareFields(
    oldFields: FieldDefinition[],
    newFields: FieldDefinition[]
  ): { addedFields: FieldDefinition[]; removedFields: FieldDefinition[] } {
    const getFieldKey = (f: FieldDefinition) => {
      if (f.relation) {
        return `${f.name}:${f.relation.type}:${f.relation.target}`
      }
      return `${f.name}:${f.type}`
    }

    const oldFieldKeys = new Set(oldFields.map(getFieldKey))
    const newFieldKeys = new Set(newFields.map(getFieldKey))

    const addedFields = newFields.filter((f) => !oldFieldKeys.has(getFieldKey(f)))
    const removedFields = oldFields.filter((f) => !newFieldKeys.has(getFieldKey(f)))

    return { addedFields, removedFields }
  }

  /**
   * Check if a model file exists
   */
  modelExists(name: string): boolean {
    const fileName = this.toSnakeCase(name)
    const modelPath = app.makePath(`app/models/${fileName}.ts`)
    return existsSync(modelPath)
  }
}
