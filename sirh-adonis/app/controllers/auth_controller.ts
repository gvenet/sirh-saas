import type { HttpContext } from '@adonisjs/core/http'
import User, { Role } from '#models/user'
import {
  signupValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
} from '#validators/auth_validator'
import hash from '@adonisjs/core/services/hash'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import { DateTime } from 'luxon'
import crypto from 'node:crypto'

export default class AuthController {
  /**
   * Sign up a new user
   */
  async signup({ request, response }: HttpContext) {
    const data = await request.validateUsing(signupValidator)

    // Check if email already exists
    const existingUser = await User.findBy('email', data.email)
    if (existingUser) {
      return response.status(400).json({
        message: 'Email already registered',
      })
    }

    const user = await User.create({
      ...data,
      role: (data.role as Role) || Role.AGENT,
      isActive: true,
    })

    // Generate access token
    const token = await User.accessTokens.create(user)

    return response.status(201).json({
      user: user.serialize(),
      token: token.value!.release(),
    })
  }

  /**
   * Login user
   */
  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    // Find user by email
    const user = await User.findBy('email', email)
    if (!user) {
      return response.status(401).json({
        message: 'Invalid credentials',
      })
    }

    // Check if user is active
    if (!user.isActive) {
      return response.status(401).json({
        message: 'Account is deactivated',
      })
    }

    // Verify password
    const isValidPassword = await hash.verify(user.password, password)
    if (!isValidPassword) {
      return response.status(401).json({
        message: 'Invalid credentials',
      })
    }

    // Generate access token
    const token = await User.accessTokens.create(user)

    return response.json({
      user: user.serialize(),
      token: token.value!.release(),
    })
  }

  /**
   * Get current user profile
   */
  async me({ auth, response }: HttpContext) {
    const user = auth.user!
    return response.json(user.serialize())
  }

  /**
   * Forgot password - send reset email
   */
  async forgotPassword({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)

    const user = await User.findBy('email', email)
    if (!user) {
      // Don't reveal if email exists
      return response.json({
        message: 'If this email exists, a reset link has been sent',
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    user.resetPasswordToken = await hash.make(resetToken)
    user.resetPasswordExpires = DateTime.now().plus({ hours: 1 })
    await user.save()

    // Build reset URL
    const frontendUrl = env.get('FRONTEND_URL', 'http://localhost:4200')
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`

    // Send email
    await mail.send((message) => {
      message
        .from(env.get('MAIL_FROM', 'noreply@sirh.com'))
        .to(user.email)
        .subject('Réinitialisation de votre mot de passe - SIRH')
        .html(`
          <h1>Réinitialisation de mot de passe</h1>
          <p>Bonjour ${user.firstName},</p>
          <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
          <p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Ce lien expire dans 1 heure.</p>
          <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
          <p>Cordialement,<br>L'équipe SIRH</p>
        `)
    })

    console.log(`Reset email sent to ${email}`)

    return response.json({
      message: 'If this email exists, a reset link has been sent',
    })
  }

  /**
   * Reset password with token
   */
  async resetPassword({ request, response }: HttpContext) {
    const { token, newPassword } = await request.validateUsing(resetPasswordValidator)

    // Find user with valid reset token
    const users = await User.query()
      .whereNotNull('resetPasswordToken')
      .where('resetPasswordExpires', '>', DateTime.now().toSQL())

    let targetUser: User | null = null
    for (const user of users) {
      const isValidToken = await hash.verify(user.resetPasswordToken!, token)
      if (isValidToken) {
        targetUser = user
        break
      }
    }

    if (!targetUser) {
      return response.status(400).json({
        message: 'Invalid or expired reset token',
      })
    }

    // Update password and clear reset token
    targetUser.password = newPassword
    targetUser.resetPasswordToken = null
    targetUser.resetPasswordExpires = null
    await targetUser.save()

    return response.json({
      message: 'Password reset successfully',
    })
  }

  /**
   * Change password for authenticated user
   */
  async changePassword({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { currentPassword, newPassword } = await request.validateUsing(changePasswordValidator)

    // Verify current password
    const isValidPassword = await hash.verify(user.password, currentPassword)
    if (!isValidPassword) {
      return response.status(400).json({
        message: 'Current password is incorrect',
      })
    }

    // Update password
    user.password = newPassword
    await user.save()

    return response.json({
      message: 'Password changed successfully',
    })
  }

  /**
   * Logout - revoke current token
   */
  async logout({ auth, response }: HttpContext) {
    const user = auth.user!
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)

    return response.json({
      message: 'Logged out successfully',
    })
  }
}
