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
  const secure = config.smtpPort === 465;
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure,
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

export interface DiscountApprovalEmailParams {
  to: string;
  approverName: string | null;
  requestedBy: string;
  patientName: string;
  episodeId: number;
  discountPercent: number;
  discountAmount: number;
  discountNotes: string;
  hospitalName?: string;
  tenantSmtp?: TenantSmtpConfig | null;
}

export async function sendDiscountApprovalEmail(params: DiscountApprovalEmailParams): Promise<void> {
  const { to, approverName, requestedBy, patientName, episodeId, discountPercent, discountAmount, discountNotes, hospitalName, tenantSmtp } = params;
  let transporter: nodemailer.Transporter;
  let fromEmail: string;
  let fromName: string;
  const displayName = hospitalName || "Hospital CRM";

  if (tenantSmtp) {
    transporter = createTransporterFromConfig(tenantSmtp);
    fromEmail = tenantSmtp.smtpFromEmail || tenantSmtp.smtpUser;
    fromName = tenantSmtp.smtpFromName || displayName;
  } else {
    const global = createGlobalTransporter();
    if (!global) {
      console.error("SMTP not configured; skipping discount approval email");
      return;
    }
    transporter = global.transporter;
    fromEmail = global.fromEmail;
    fromName = displayName;
  }

  const formattedAmount = `₹${discountAmount.toLocaleString("en-IN")}`;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: `Discount Approval Required — ${patientName} (Episode #${episodeId})`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background: #fff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f4c81; margin: 0; font-size: 20px;">${displayName}</h2>
          <p style="color: #888; font-size: 13px; margin: 4px 0 0 0;">Discount Approval Request</p>
        </div>
        <p style="font-size: 15px; color: #333;">Hello <strong>${approverName || "Approver"}</strong>,</p>
        <p style="font-size: 15px; color: #333;"><strong>${requestedBy}</strong> has submitted a discount request that requires your approval.</p>
        <div style="background: #f8f9fa; border-left: 4px solid #0f4c81; padding: 16px 20px; border-radius: 4px; margin: 20px 0;">
          <table style="width: 100%; font-size: 14px; color: #333;">
            <tr><td style="padding: 4px 0; color: #888; width: 40%;">Patient</td><td style="font-weight: 600;">${patientName}</td></tr>
            <tr><td style="padding: 4px 0; color: #888;">Episode</td><td>#${episodeId}</td></tr>
            <tr><td style="padding: 4px 0; color: #888;">Discount</td><td style="font-weight: 600; color: #e67e22;">${discountPercent}% (${formattedAmount})</td></tr>
            ${discountNotes ? `<tr><td style="padding: 4px 0; color: #888;">Notes</td><td>${discountNotes}</td></tr>` : ""}
          </table>
        </div>
        <p style="font-size: 14px; color: #555;">Please log in to the CRM to review and approve or reject this request.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : ""}/transactions/${episodeId}" 
             style="background: #0f4c81; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">
            Review Discount Request
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #aaa; text-align: center;">${displayName}</p>
      </div>
    `,
  });
}
