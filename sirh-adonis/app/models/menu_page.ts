import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import MenuItem from './menu_item.js'

export default class MenuPage extends BaseModel {
  static table = 'menu_pages'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare menuItemId: number

  @belongsTo(() => MenuItem)
  declare menuItem: BelongsTo<typeof MenuItem>

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare content: string | null

  @column()
  declare config: Record<string, any> | null

  @column()
  declare active: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
