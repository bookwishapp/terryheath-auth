const nodemailer = require('nodemailer');

// Create transporter with SES SMTP config
const transporter = nodemailer.createTransport({
  host: process.env.SES_SMTP_HOST,
  port: parseInt(process.env.SES_SMTP_PORT, 10),
  secure: process.env.SES_SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SES_SMTP_USER,
    pass: process.env.SES_SMTP_PASS
  }
});

// Send magic link email
async function sendMagicLink(email, token) {
  const magicLinkUrl = `${process.env.AUTH_BASE_URL}/auth/verify?token=${token}`;

  const mailOptions = {
    from: process.env.SES_FROM_EMAIL,
    to: email,
    subject: `Sign in to ${process.env.APP_NAME}`,
    text: `Click this link to sign in to ${process.env.APP_NAME}:\n\n${magicLinkUrl}\n\nThis link will expire in 15 minutes. If you didn't request this email, you can safely ignore it.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Magic link sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send magic link email');
  }
}

module.exports = {
  sendMagicLink
};