import type { FieldDefinition } from './generator_service.js'

export default class FileGeneratorService {
  /**
   * Generate Lucid model content
   */
  generateModel(modelName: string, tableName: string, fields: FieldDefinition[]): string {
    const imports = ["import { DateTime } from 'luxon'", "import { BaseModel, column } from '@adonisjs/lucid/orm'"]
    const relationImports: string[] = []
    const relationDecorators: string[] = []

    // Check for relations
    for (const field of fields) {
      if (field.relation) {
        const targetModel = this.toPascalCase(field.relation.target)
        if (field.relation.type === 'many-to-one') {
          if (!relationImports.includes('belongsTo')) relationImports.push('belongsTo')
          if (!relationImports.includes('BelongsTo')) relationImports.push('BelongsTo')
        } else if (field.relation.type === 'one-to-many') {
          if (!relationImports.includes('hasMany')) relationImports.push('hasMany')
          if (!relationImports.includes('HasMany')) relationImports.push('HasMany')
        } else if (field.relation.type === 'many-to-many') {
          if (!relationImports.includes('manyToMany')) relationImports.push('manyToMany')
          if (!relationImports.includes('ManyToMany')) relationImports.push('ManyToMany')
        }
      }
    }

    if (relationImports.length > 0) {
      imports[1] = `import { BaseModel, column, ${relationImports.join(', ')} } from '@adonisjs/lucid/orm'`
    }

    // Generate field declarations
    const fieldDeclarations = fields
      .filter((f) => !f.relation || f.relation.type === 'many-to-one')
      .map((field) => this.generateFieldDeclaration(field))
      .join('\n\n')

    // Generate relation declarations
    const relationDeclarations = fields
      .filter((f) => f.relation)
      .map((field) => this.generateRelationDeclaration(field))
      .join('\n\n')

    // Add relation model imports
    const relationModelImports = fields
      .filter((f) => f.relation)
      .map((f) => {
        const targetModel = this.toPascalCase(f.relation!.target)
        const targetFile = this.toSnakeCase(f.relation!.target)
        return `import ${targetModel} from './${targetFile}.js'`
      })
      .filter((v, i, a) => a.indexOf(v) === i) // unique
      .join('\n')

    return `${imports.join('\n')}
${relationModelImports ? '\n' + relationModelImports : ''}

export default class ${modelName} extends BaseModel {
  static table = '${tableName}'

  @column({ isPrimary: true })
  declare id: number

${fieldDeclarations}

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
${relationDeclarations ? '\n' + relationDeclarations : ''}}
`
  }

  /**
   * Generate controller content
   */
  generateController(modelName: string, fileName: string): string {
    return `import type { HttpContext } from '@adonisjs/core/http'
import ${modelName} from '#models/${fileName}'
import { create${modelName}Validator, update${modelName}Validator } from '#validators/${fileName}_validator'

export default class ${modelName}Controller {
  async index({ response }: HttpContext) {
    const items = await ${modelName}.all()
    return response.json(items)
  }

  async show({ params, response }: HttpContext) {
    const item = await ${modelName}.findOrFail(params.id)
    return response.json(item)
  }

  async store({ request, response }: HttpContext) {
    const data = await request.validateUsing(create${modelName}Validator)
    const item = await ${modelName}.create(data)
    return response.status(201).json(item)
  }

  async update({ params, request, response }: HttpContext) {
    const item = await ${modelName}.findOrFail(params.id)
    const data = await request.validateUsing(update${modelName}Validator)
    item.merge(data)
    await item.save()
    return response.json(item)
  }

  async destroy({ params, response }: HttpContext) {
    const item = await ${modelName}.findOrFail(params.id)
    await item.delete()
    return response.status(204).send('')
  }
}
`
  }

  /**
   * Generate validator content
   */
  generateValidator(modelName: string, fields: FieldDefinition[]): string {
    const validationRules = fields
      .filter((f) => !f.relation || f.relation.type === 'many-to-one')
      .map((field) => {
        const rule = this.getValidationRule(field)
        return `    ${field.name}: ${rule}`
      })
      .join(',\n')

    const optionalRules = fields
      .filter((f) => !f.relation || f.relation.type === 'many-to-one')
      .map((field) => {
        const rule = this.getValidationRule(field, true)
        return `    ${field.name}: ${rule}`
      })
      .join(',\n')

    return `import vine from '@vinejs/vine'

export const create${modelName}Validator = vine.compile(
  vine.object({
${validationRules}
  })
)

export const update${modelName}Validator = vine.compile(
  vine.object({
${optionalRules}
  })
)
`
  }

  private generateFieldDeclaration(field: FieldDefinition): string {
    const tsType = this.getTsType(field)
    const nullable = field.required === false ? ' | null' : ''

    if (field.relation?.type === 'many-to-one') {
      return `  @column()
  declare ${field.name}Id: number${nullable}`
    }

    return `  @column()
  declare ${field.name}: ${tsType}${nullable}`
  }

  private generateRelationDeclaration(field: FieldDefinition): string {
    if (!field.relation) return ''

    const targetModel = this.toPascalCase(field.relation.target)
    const targetFile = this.toSnakeCase(field.relation.target)

    switch (field.relation.type) {
      case 'many-to-one':
        return `  @belongsTo(() => ${targetModel})
  declare ${field.name}: BelongsTo<typeof ${targetModel}>`

      case 'one-to-many':
        return `  @hasMany(() => ${targetModel})
  declare ${field.name}: HasMany<typeof ${targetModel}>`

      case 'many-to-many':
        return `  @manyToMany(() => ${targetModel})
  declare ${field.name}: ManyToMany<typeof ${targetModel}>`

      default:
        return ''
    }
  }

  private getTsType(field: FieldDefinition): string {
    if (field.relation) return 'number' // Foreign key

    switch (field.type) {
      case 'string':
      case 'text':
        return 'string'
      case 'number':
      case 'integer':
      case 'float':
        return 'number'
      case 'boolean':
        return 'boolean'
      case 'date':
      case 'datetime':
        return 'DateTime'
      case 'json':
        return 'Record<string, any>'
      default:
        return 'string'
    }
  }

  private getValidationRule(field: FieldDefinition, optional = false): string {
    let rule: string

    switch (field.type) {
      case 'string':
        rule = 'vine.string()'
        break
      case 'text':
        rule = 'vine.string()'
        break
      case 'number':
      case 'integer':
        rule = 'vine.number()'
        break
      case 'float':
        rule = 'vine.number()'
        break
      case 'boolean':
        rule = 'vine.boolean()'
        break
      case 'date':
      case 'datetime':
        rule = 'vine.date()'
        break
      default:
        rule = 'vine.string()'
    }

    if (field.relation?.type === 'many-to-one') {
      rule = 'vine.number()'
    }

    if (optional || field.required === false) {
      rule += '.optional()'
    }

    return rule
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

  /**
   * Generate migration content for creating a table
   */
  generateMigration(tableName: string, fields: FieldDefinition[]): string {
    const columns = fields
      .filter((f) => !f.relation || f.relation.type === 'many-to-one')
      .map((field) => this.getMigrationColumn(field))
      .join('\n      ')

    const foreignKeys = fields
      .filter((f) => f.relation?.type === 'many-to-one')
      .map((field) => {
        const targetTable = this.toSnakeCase(field.relation!.target) + 's'
        const columnName = this.toSnakeCase(field.name) + '_id'
        return `table.foreign('${columnName}').references('id').inTable('${targetTable}').onDelete('SET NULL')`
      })
      .join('\n      ')

    return `import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = '${tableName}'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      ${columns}
      table.timestamp('created_at')
      table.timestamp('updated_at')
      ${foreignKeys}
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
`
  }

  /**
   * Generate migration content for dropping a table
   */
  generateDropMigration(tableName: string): string {
    return `import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = '${tableName}'

  async up() {
    this.schema.dropTable(this.tableName)
  }

  async down() {
    // Cannot restore table without knowing original schema
  }
}
`
  }

  private getMigrationColumn(field: FieldDefinition): string {
    const columnName = field.relation?.type === 'many-to-one'
      ? this.toSnakeCase(field.name) + '_id'
      : this.toSnakeCase(field.name)

    let columnDef: string

    if (field.relation?.type === 'many-to-one') {
      columnDef = `table.integer('${columnName}').unsigned()`
    } else {
      switch (field.type) {
        case 'string':
          columnDef = `table.string('${columnName}', 255)`
          break
        case 'text':
          columnDef = `table.text('${columnName}')`
          break
        case 'number':
        case 'integer':
          columnDef = `table.integer('${columnName}')`
          break
        case 'float':
          columnDef = `table.decimal('${columnName}', 10, 2)`
          break
        case 'boolean':
          columnDef = `table.boolean('${columnName}').defaultTo(false)`
          break
        case 'date':
          columnDef = `table.date('${columnName}')`
          break
        case 'datetime':
          columnDef = `table.timestamp('${columnName}')`
          break
        case 'json':
          columnDef = `table.jsonb('${columnName}')`
          break
        default:
          columnDef = `table.string('${columnName}', 255)`
      }
    }

    if (field.required === true) {
      columnDef += '.notNullable()'
    } else {
      columnDef += '.nullable()'
    }

    if (field.unique) {
      columnDef += '.unique()'
    }

    return columnDef
  }
}
