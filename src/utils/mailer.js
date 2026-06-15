const nodemailer = require('nodemailer');
const config = require('../config/config');

// If SMTP settings are missing, use a safe fallback transport that just logs the email
let transporter;
const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || config.smtpHost,
    port: parseInt(process.env.SMTP_PORT || config.smtpPort || '587', 10),
    secure: (process.env.SMTP_SECURE === 'true') || !!config.smtpSecure, // true for 465
    auth: {
      user: process.env.SMTP_USER || config.smtpUser,
      pass: process.env.SMTP_PASS || config.smtpPass
    }
  });
} else {
  console.warn('⚠️ SMTP non configuré : les e-mails seront affichés dans les logs au lieu d\'être envoyés. Pour activer l\'envoi, définissez SMTP_HOST/SMTP_USER/SMTP_PASS.');
  // Use nodemailer's jsonTransport so we don't attempt an external connection
  transporter = nodemailer.createTransport({ jsonTransport: true });
}

async function sendMail({ to, subject, text, html }) {
  const mailOptions = {
    from: process.env.SMTP_FROM || config.smtpFrom || 'no-reply@dls.com',
    to,
    subject,
    text,
    html
  };

  const info = await transporter.sendMail(mailOptions);

  // If using jsonTransport (fallback), log the mail contents to help debugging
  if (!smtpConfigured) {
    console.log('📧 [MAIL-LOG] Email (not sent, SMTP not configured):', JSON.stringify(mailOptions, null, 2));
    console.log('📧 [MAIL-LOG] Transport output:', info);
  }

  return info;
}

module.exports = { sendMail };