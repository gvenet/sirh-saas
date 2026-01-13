const nodemailer = require('nodemailer');

async function testSMTP() {
  console.log('Testing SMTP connection to Gmail...');
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    debug: true,
    logger: true,
  });

  try {
    console.log('\n🔍 Verifying connection...');
    await transporter.verify();
    console.log('\n✅ SMTP connection successful!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ SMTP connection failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Command:', error.command);
    process.exit(1);
  }
}

testSMTP();
