import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter() {
    const mailUser = this.configService.get<string>('MAIL_USER');
    const mailPass = this.configService.get<string>('MAIL_PASSWORD');
    const mailHost = this.configService.get<string>('MAIL_HOST');

    // Si HOST n'est pas configuré en dev, utiliser Ethereal (compte de test)
    // Note: USER et PASS peuvent être vides (ex: MailHog n'a pas besoin d'auth)
    if (
      (!mailHost || mailHost.trim() === '') &&
      this.configService.get<string>('NODE_ENV') === 'development'
    ) {
      console.log('⚠️  No mail credentials configured. Creating Ethereal test account...');
      const testAccount = await nodemailer.createTestAccount();

      const mailConfig = {
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      };

      console.log('✅ Ethereal test account created:');
      console.log('   📧 View emails at: https://ethereal.email');
      console.log('   👤 User:', testAccount.user);
      console.log('   🔑 Pass:', testAccount.pass);

      this.transporter = nodemailer.createTransport(mailConfig);
      return;
    }

    // Configuration normale avec les credentials fournis
    const portStr = this.configService.get<string>('MAIL_PORT');
    const port = portStr ? parseInt(portStr, 10) : 587;
    const secure = this.configService.get<string>('MAIL_SECURE') === 'true' || port === 465;
    const host = this.configService.get<string>('MAIL_HOST');

    console.log('Mail config from env:', { host, port, portType: typeof port });

    // Configuration simplifiée pour MailHog (port 1025)
    if (port === 1025) {
      const mailConfig: any = {
        host: host,
        port: 1025,
        secure: false,
      };

      console.log('Using MailHog config:', {
        host: mailConfig.host,
        port: mailConfig.port,
      });

      this.transporter = nodemailer.createTransport(mailConfig);
      return;
    }

    // Configuration standard pour Gmail / autres SMTP
    const mailConfig: any = {
      host: host,
      port: port,
      secure: secure,
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    };

    // Ajouter auth seulement si user/pass sont fournis
    if (mailUser && mailPass) {
      mailConfig.auth = {
        user: mailUser,
        pass: mailPass,
      };
    }

    console.log('Nodemailer config:', {
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      user: mailConfig.auth?.user || 'none',
      hasPassword: !!mailConfig.auth?.pass,
    });

    this.transporter = nodemailer.createTransport(mailConfig);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    console.log('sendPasswordResetEmail called for:', to);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const mailOptions = {
      from: this.configService.get<string>('MAIL_FROM'),
      to,
      subject: 'Réinitialisation de votre mot de passe - SIRH',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: #f7fafc;
              border-radius: 10px;
              padding: 30px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              width: 60px;
              height: 60px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 12px;
              margin: 0 auto 15px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 24px;
              font-weight: bold;
            }
            .button {
              display: inline-block;
              padding: 14px 32px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white !important;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .warning {
              background: #fff5f5;
              border-left: 4px solid #fc8181;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #718096;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">S</div>
              <h1 style="color: #2d3748; margin: 0;">Réinitialisation de mot de passe</h1>
            </div>

            <p>Bonjour,</p>

            <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte SIRH.</p>

            <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>

            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
            </div>

            <div class="warning">
              <strong>⚠️ Important :</strong> Ce lien est valable pendant 1 heure et ne peut être utilisé qu'une seule fois.
            </div>

            <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.</p>

            <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>

            <div class="footer">
              <p>Cet email a été envoyé par le système SIRH</p>
              <p>© ${new Date().getFullYear()} SIRH - Tous droits réservés</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Réinitialisation de mot de passe - SIRH

        Bonjour,

        Vous avez demandé la réinitialisation de votre mot de passe pour votre compte SIRH.

        Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :
        ${resetUrl}

        ⚠️ Important : Ce lien est valable pendant 1 heure et ne peut être utilisé qu'une seule fois.

        Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.

        © ${new Date().getFullYear()} SIRH - Tous droits réservés
      `,
    };

    try {
      console.log('Sending email to:', to);
      console.log('From:', mailOptions.from);
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      console.log('Response:', info.response);

      // Si c'est Ethereal, afficher l'URL pour voir l'email
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('📧 Preview email at:', previewUrl);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        command: error.command,
      });
      throw new Error('Failed to send password reset email');
    }
  }
}
