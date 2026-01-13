require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('=== Configuration actuelle ===');
console.log('MAIL_HOST:', process.env.MAIL_HOST);
console.log('MAIL_PORT:', process.env.MAIL_PORT);
console.log('MAIL_USER:', process.env.MAIL_USER);
console.log('MAIL_SECURE:', process.env.MAIL_SECURE);

const config = {
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: false,
  logger: true,
  debug: true,
};

console.log('\n=== Test de connexion ===');
const transporter = nodemailer.createTransport(config);

transporter.sendMail({
  from: 'SIRH <noreply@sirh.com>',
  to: 'test@example.com',
  subject: 'Test',
  text: 'Test'
}).then(info => {
  console.log('\n✅ SUCCESS!');
  console.log('MessageID:', info.messageId);
  process.exit(0);
}).catch(err => {
  console.error('\n❌ ERROR:', err.message);
  process.exit(1);
});
