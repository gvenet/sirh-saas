import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const mailUser = env.get('MAIL_USER')
const mailPassword = env.get('MAIL_PASSWORD')

const mailConfig = defineConfig({
  default: 'smtp',

  mailers: {
    smtp: transports.smtp({
      host: env.get('MAIL_HOST', 'localhost'),
      port: env.get('MAIL_PORT', 1025),
      secure: env.get('MAIL_SECURE', false),
      // Only include auth if credentials are provided
      ...(mailUser && mailPassword
        ? {
            auth: {
              type: 'login' as const,
              user: mailUser,
              pass: mailPassword,
            },
          }
        : {}),
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
