import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'menu_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('label').notNullable()
      table.string('entity_name').nullable()
      table.integer('page_id').nullable().references('id').inTable('entity_pages').onDelete('SET NULL')
      table.string('route').nullable()
      table.string('icon').nullable()
      table.integer('order').defaultTo(0).notNullable()
      table.boolean('active').defaultTo(true).notNullable()
      table.integer('application_id').notNullable().references('id').inTable('applications').onDelete('CASCADE')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
