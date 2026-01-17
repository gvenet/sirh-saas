import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasOne, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne, HasMany } from '@adonisjs/lucid/types/relations'
import Application from './application.js'
import MenuPage from './menu_page.js'

export default class MenuItem extends BaseModel {
  static table = 'menu_items'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare label: string

  @column()
  declare entityName: string | null

  @column()
  declare pageId: number | null

  @column()
  declare route: string | null

  @column()
  declare icon: string | null

  @column()
  declare order: number

  @column()
  declare active: boolean

  @column()
  declare applicationId: number

  @column()
  declare parentId: number | null

  @belongsTo(() => Application)
  declare application: BelongsTo<typeof Application>

  @belongsTo(() => MenuItem, { foreignKey: 'parentId' })
  declare parent: BelongsTo<typeof MenuItem>

  @hasMany(() => MenuItem, { foreignKey: 'parentId' })
  declare children: HasMany<typeof MenuItem>

  @hasOne(() => MenuPage)
  declare menuPage: HasOne<typeof MenuPage>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
