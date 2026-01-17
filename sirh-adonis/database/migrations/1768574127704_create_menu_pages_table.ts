import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'menu_pages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('menu_item_id').notNullable().references('id').inTable('menu_items').onDelete('CASCADE')
      table.string('title').notNullable()
      table.text('description').nullable()
      table.text('content').nullable()
      table.jsonb('config').nullable()
      table.boolean('active').defaultTo(true).notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['menu_item_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
