import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'page_fields'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('entity_page_id')
        .unsigned()
        .references('id')
        .inTable('entity_pages')
        .onDelete('CASCADE')
        .notNullable()
      table.string('field_name').notNullable()
      table.string('field_path').nullable()
      table
        .enum('display_type', [
          'text',
          'textarea',
          'number',
          'date',
          'datetime',
          'boolean',
          'select',
          'autocomplete',
          'list',
          'table',
          'hidden',
        ])
        .defaultTo('text')
        .notNullable()
      table.string('label').nullable()
      table.string('placeholder').nullable()
      table.integer('order').defaultTo(0).notNullable()
      table.string('section').nullable()
      table.integer('col_span').defaultTo(12).notNullable()
      table.boolean('visible').defaultTo(true).notNullable()
      table.boolean('read_only').defaultTo(false).notNullable()
      table.jsonb('config').nullable()
      table.jsonb('validation').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Index for ordering
      table.index(['entity_page_id', 'order'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
