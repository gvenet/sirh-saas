import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import PageField from './page_field.js'

export enum PageType {
  VIEW = 'view',
  EDIT = 'edit',
  LIST = 'list',
  CUSTOM = 'custom',
}

export default class EntityPage extends BaseModel {
  static table = 'entity_pages'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare entityName: string

  @column()
  declare pageType: PageType

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare isDefault: boolean

  @column()
  declare order: number

  @column()
  declare active: boolean

  @column()
  declare config: Record<string, any> | null

  @hasMany(() => PageField)
  declare fields: HasMany<typeof PageField>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
