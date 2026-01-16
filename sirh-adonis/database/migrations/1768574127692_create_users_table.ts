import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('email', 254).notNullable().unique()
      table.string('first_name').notNullable()
      table.string('last_name').notNullable()
      table.string('password').notNullable()
      table.enum('role', ['admin', 'rh', 'agent', 'manager']).defaultTo('agent').notNullable()
      table.boolean('is_active').defaultTo(true).notNullable()
      table.string('position').nullable()
      table.string('department').nullable()
      table.string('reset_password_token').nullable()
      table.timestamp('reset_password_expires').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
