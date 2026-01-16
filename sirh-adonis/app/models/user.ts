import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

// Role enum matching NestJS
export enum Role {
  ADMIN = 'admin',
  RH = 'rh',
  AGENT = 'agent',
  MANAGER = 'manager',
}

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column()
  declare firstName: string

  @column()
  declare lastName: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare role: Role

  @column()
  declare isActive: boolean

  @column()
  declare position: string | null

  @column()
  declare department: string | null

  @column({ serializeAs: null })
  declare resetPasswordToken: string | null

  @column.dateTime()
  declare resetPasswordExpires: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Access tokens for API authentication
  static accessTokens = DbAccessTokensProvider.forModel(User)

  // Note: Password hashing is handled by AuthFinder mixin

  // Helper to get full name
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  // Serialize for JSON response (excludes sensitive fields)
  serialize() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.fullName,
      role: this.role,
      isActive: this.isActive,
      position: this.position,
      department: this.department,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
