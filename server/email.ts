import nodemailer from "nodemailer";

export interface TenantSmtpConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFromEmail: string;
  smtpFromName: string;
  smtpSecure?: boolean;
}

function createTransporterFromConfig(config: TenantSmtpConfig) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure ?? config.smtpPort === 465,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });
}

function createGlobalTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
    fromEmail: process.env.SMTP_FROM_EMAIL || user,
    fromName: "myProSys Hospital CRM",
  };
}

export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  resetLink: string,
  tenantSmtp?: TenantSmtpConfig | null,
  hospitalName?: string
): Promise<void> {
  let transporter: nodemailer.Transporter;
  let fromEmail: string;
  let fromName: string;

  if (tenantSmtp) {
    transporter = createTransporterFromConfig(tenantSmtp);
    fromEmail = tenantSmtp.smtpFromEmail || tenantSmtp.smtpUser;
    fromName = tenantSmtp.smtpFromName || hospitalName || "Hospital CRM";
  } else {
    const global = createGlobalTransporter();
    if (!global) {
      console.error("SMTP not configured. Reset link:", resetLink);
      throw new Error("Email service is not configured. Please contact your administrator.");
    }
    transporter = global.transporter;
    fromEmail = global.fromEmail;
    fromName = hospitalName || global.fromName;
  }

  const displayName = hospitalName || "Hospital CRM";

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: `Password Reset - ${displayName}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #fff;">
        <div style="text-align: center; margin-bottom: 28px;">
          <h2 style="color: #0f4c81; margin: 0; font-size: 22px;">${displayName}</h2>
        </div>
        <p style="font-size: 15px; color: #333;">Hello <strong>${userName}</strong>,</p>
        <p style="font-size: 15px; color: #333;">We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetLink}" style="background-color: #0f4c81; color: #fff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600; display: inline-block;">Reset Password</a>
        </div>
        <p style="font-size: 13px; color: #888;">This link expires in 1 hour. If you did not request a password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #aaa; text-align: center;">${displayName}</p>
      </div>
    `,
  });
}
