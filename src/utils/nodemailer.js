// src/utils/nodemailer.js
// FINAL: Brevo SMTP via Nodemailer

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST,
  port: Number(process.env.BREVO_SMTP_PORT),
  secure: false, // STARTTLS on 587
  auth: {
    user: process.env.BREVO_SMTP_USER, // MUST be 'apikey'
    pass: process.env.BREVO_SMTP_PASS, // MUST be xsmtpsib-...
  },
  authMethod: 'LOGIN', // force LOGIN to avoid auth negotiation issues
});

// Verify SMTP on startup (fail fast)
(async () => {
  try {
    await transporter.verify();
    console.log('SMTP VERIFY: OK');
  } catch (err) {
    console.error('SMTP VERIFY: FAILED');
    console.error(err.message);
  }
})();

exports.sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
};
