import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'entity_pages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('entity_name').notNullable()
      table.enum('page_type', ['view', 'edit', 'list', 'custom']).defaultTo('view').notNullable()
      table.string('name').notNullable()
      table.text('description').nullable()
      table.boolean('is_default').defaultTo(true).notNullable()
      table.integer('order').defaultTo(0).notNullable()
      table.boolean('active').defaultTo(true).notNullable()
      table.jsonb('config').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Index for quick lookup by entity
      table.index(['entity_name', 'page_type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
