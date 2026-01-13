const nodemailer = require('nodemailer');

async function testMailHog() {
  console.log('Testing MailHog...');
  
  const transporter = nodemailer.createTransport({
    host: 'localhost',
    port: 1025,
    secure: false,
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: 'SIRH <noreply@sirh.com>',
      to: 'guillaume.venet@septeo.com',
      subject: 'Test MailHog - SIRH',
      html: '<h1>Test Email</h1><p>Si vous voyez ceci, MailHog fonctionne !</p>',
    });
    console.log('✅ Email envoyé avec succès !');
    console.log('📧 Ouvrez http://localhost:8025 pour voir l\'email');
    console.log('Message ID:', info.messageId);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

testMailHog();
