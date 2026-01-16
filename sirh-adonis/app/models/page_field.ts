import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import EntityPage from './entity_page.js'

export enum FieldDisplayType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  DATE = 'date',
  DATETIME = 'datetime',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  AUTOCOMPLETE = 'autocomplete',
  LIST = 'list',
  TABLE = 'table',
  HIDDEN = 'hidden',
}

export default class PageField extends BaseModel {
  static table = 'page_fields'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare entityPageId: number

  @belongsTo(() => EntityPage)
  declare page: BelongsTo<typeof EntityPage>

  @column()
  declare fieldName: string

  @column()
  declare fieldPath: string | null

  @column()
  declare displayType: FieldDisplayType

  @column()
  declare label: string | null

  @column()
  declare placeholder: string | null

  @column()
  declare order: number

  @column()
  declare section: string | null

  @column()
  declare colSpan: number

  @column()
  declare visible: boolean

  @column()
  declare readOnly: boolean

  @column()
  declare config: Record<string, any> | null

  @column()
  declare validation: Record<string, any> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
