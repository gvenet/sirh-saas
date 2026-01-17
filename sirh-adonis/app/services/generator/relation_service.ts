import app from '@adonisjs/core/services/app'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import logger from '@adonisjs/core/services/logger'
import type { FieldDefinition } from './generator_service.js'

export default class RelationService {
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

  private pluralize(word: string): string {
    if (word.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(word.charAt(word.length - 2))) {
      return word.slice(0, -1) + 'ies'
    }
    if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
      return word + 'es'
    }
    return word + 's'
  }

  /**
   * Update target models with inverse relations for many-to-many and many-to-one
   */
  async updateInverseRelations(sourceModel: string, sourceTable: string, fields: FieldDefinition[]) {
    for (const field of fields) {
      if (!field.relation) continue

      const targetModel = this.toPascalCase(field.relation.target)
      const targetFile = this.toSnakeCase(field.relation.target)
      const targetPath = app.makePath(`app/models/${targetFile}.ts`)

      if (!existsSync(targetPath)) {
        logger.warn({ targetModel, targetPath }, 'Target model not found, skipping inverse relation')
        continue
      }

      let targetContent = await readFile(targetPath, 'utf-8')
      const sourceFile = this.toSnakeCase(sourceModel)
      const inverseName = field.relation.inverseSide || this.pluralize(sourceModel.toLowerCase())

      // Check if inverse relation already exists
      if (targetContent.includes(`declare ${inverseName}:`)) {
        logger.info({ targetModel, inverseName }, 'Inverse relation already exists')
        continue
      }

      if (field.relation.type === 'many-to-many') {
        targetContent = this.addManyToManyInverse(
          targetContent,
          sourceModel,
          sourceFile,
          sourceTable,
          targetModel,
          inverseName
        )
        await writeFile(targetPath, targetContent)
        logger.info({ targetModel, inverseName, type: 'many-to-many' }, 'Added inverse relation')
      } else if (field.relation.type === 'many-to-one') {
        targetContent = this.addHasManyInverse(targetContent, sourceModel, sourceFile, inverseName)
        await writeFile(targetPath, targetContent)
        logger.info({ targetModel, inverseName, type: 'one-to-many' }, 'Added inverse relation')
      }
    }
  }

  private addManyToManyInverse(
    content: string,
    sourceModel: string,
    sourceFile: string,
    sourceTable: string,
    targetModel: string,
    inverseName: string
  ): string {
    // Add manyToMany import if needed
    if (!content.includes('manyToMany')) {
      content = content.replace(
        /import \{ BaseModel, column(.*?) \} from '@adonisjs\/lucid\/orm'/,
        "import { BaseModel, column$1, manyToMany, ManyToMany } from '@adonisjs/lucid/orm'"
      )
    }

    // Add source model import if needed
    const importStatement = `import ${sourceModel} from './${sourceFile}.js'`
    if (!content.includes(importStatement)) {
      content = content.replace("import { BaseModel", `${importStatement}\nimport { BaseModel`)
    }

    // Calculate pivot table name (alphabetically ordered)
    const targetTable = this.toSnakeCase(targetModel) + 's'
    const tables = [sourceTable.replace(/s$/, ''), targetTable.replace(/s$/, '')].sort()
    const pivotTable = `${tables[0]}_${tables[1]}`

    // Add inverse relation before the closing brace
    const inverseRelation = `
  @manyToMany(() => ${sourceModel}, {
    pivotTable: '${pivotTable}',
  })
  declare ${inverseName}: ManyToMany<typeof ${sourceModel}>
`
    return content.replace(/}[\s]*$/, `${inverseRelation}}`)
  }

  private addHasManyInverse(
    content: string,
    sourceModel: string,
    sourceFile: string,
    inverseName: string
  ): string {
    // Add hasMany import if needed
    if (!content.includes('hasMany')) {
      content = content.replace(
        /import \{ BaseModel, column(.*?) \} from '@adonisjs\/lucid\/orm'/,
        "import { BaseModel, column$1, hasMany, HasMany } from '@adonisjs/lucid/orm'"
      )
    }

    // Add source model import if needed
    const importStatement = `import ${sourceModel} from './${sourceFile}.js'`
    if (!content.includes(importStatement)) {
      content = content.replace("import { BaseModel", `${importStatement}\nimport { BaseModel`)
    }

    // Add hasMany relation before the closing brace
    const hasManyRelation = `
  @hasMany(() => ${sourceModel})
  declare ${inverseName}: HasMany<typeof ${sourceModel}>
`
    return content.replace(/}[\s]*$/, `${hasManyRelation}}`)
  }
}
