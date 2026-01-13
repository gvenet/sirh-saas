const nodemailer = require('nodemailer');

async function testSMTP() {
  console.log('Testing SMTP connection to Gmail on port 465...');
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
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
    console.log('\n✅ SMTP connection successful on port 465!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ SMTP connection failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    process.exit(1);
  }
}

testSMTP();
