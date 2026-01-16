import vine from '@vinejs/vine'

export const signupValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    password: vine.string().minLength(6),
    firstName: vine.string().minLength(1),
    lastName: vine.string().minLength(1),
    role: vine.enum(['admin', 'rh', 'agent', 'manager']).optional(),
    position: vine.string().optional(),
    department: vine.string().optional(),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    password: vine.string(),
  })
)

export const forgotPasswordValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
  })
)

export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string(),
    newPassword: vine.string().minLength(6),
  })
)

export const changePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string(),
    newPassword: vine.string().minLength(6),
  })
)
