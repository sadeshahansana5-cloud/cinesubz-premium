const nodemailer = require('nodemailer');

let transporter = null;

function getTransport() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Email is not configured yet. Set SMTP_HOST, SMTP_USER and SMTP_PASS in your Vercel project settings.');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

function otpEmailHtml(name, otp) {
  const safeName = (name || 'there').replace(/[<>]/g, '');
  const digits = otp.split('').join('&nbsp;&nbsp;');
  return `
  <div style="background:#0a090c;padding:36px 16px;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="max-width:460px;margin:0 auto;border-collapse:collapse;">
      <tr>
        <td style="background:linear-gradient(135deg,#f4d98a,#d9b24c);border-radius:16px 16px 0 0;padding:22px 28px;text-align:center;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-weight:800;font-size:22px;letter-spacing:.03em;color:#1a1208;">🎬 CineSubz</div>
        </td>
      </tr>
      <tr>
        <td style="background:#17151b;border:1px solid rgba(217,178,76,0.22);border-top:none;padding:34px 28px 30px;border-radius:0 0 16px 16px;">
          <p style="color:#f4efe4;font-size:15px;margin:0 0 6px;">Hi ${safeName},</p>
          <p style="color:#b6afc0;font-size:14px;line-height:1.6;margin:0 0 26px;">
            Use the verification code below to finish creating your CineSubz account.
            This code expires in <strong style="color:#f4d98a;">10 minutes</strong>.
          </p>
          <div style="text-align:center;margin:0 0 26px;">
            <span style="display:inline-block;background:rgba(217,178,76,0.1);border:1px solid rgba(217,178,76,0.35);
              border-radius:12px;padding:16px 22px;font-family:'Courier New',monospace;font-size:30px;
              font-weight:700;letter-spacing:8px;color:#f4d98a;">${digits}</span>
          </div>
          <p style="color:#726c7c;font-size:12.5px;line-height:1.6;margin:0;">
            Didn't request this? You can safely ignore this email — your account will not be created without this code.
          </p>
        </td>
      </tr>
      <tr>
        <td style="text-align:center;padding:18px 10px 0;color:#726c7c;font-size:11.5px;">
          Made for Sri Lankan movie lovers · CineSubz
        </td>
      </tr>
    </table>
  </div>`;
}

async function sendOtpEmail(to, name, otp) {
  const transport = getTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({
    from: `"CineSubz" <${from}>`,
    to,
    subject: `${otp} is your CineSubz verification code`,
    html: otpEmailHtml(name, otp),
    text: `Your CineSubz verification code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
  });
}

module.exports = { sendOtpEmail };
