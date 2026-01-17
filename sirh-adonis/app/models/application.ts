import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import MenuItem from './menu_item.js'

export default class Application extends BaseModel {
  static table = 'applications'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare icon: string | null

  @column()
  declare order: number

  @column()
  declare active: boolean

  @hasMany(() => MenuItem)
  declare menuItems: HasMany<typeof MenuItem>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
