const nodemailer = require('nodemailer');

async function testGmail() {
  console.log('Testing Gmail SMTP with relaxed settings...');
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'venetguillaume@gmail.com',
      pass: 'pypbtjqeoxuglurc',
    },
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3',
    },
    requireTLS: true,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    debug: true,
    logger: true,
  });

  try {
    console.log('\n🔍 Sending test email...');
    const info = await transporter.sendMail({
      from: 'SIRH <venetguillaume@gmail.com>',
      to: 'guillaume.venet@septeo.com',
      subject: 'Test SIRH',
      text: 'Test email from SIRH',
    });
    console.log('\n✅ Email sent!', info.messageId);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

testGmail();
