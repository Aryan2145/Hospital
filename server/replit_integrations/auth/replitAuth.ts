import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../../db";
import { crmUsers, tenants, tenantSettings, systemRoles } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { sendPasswordResetEmail, TenantSmtpConfig } from "../../email";
import { sendPasswordResetSMS, isMSG91Configured } from "../../sms";

export function getSession() {
  const sessionTtl = 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { mobile, password } = req.body;
      if (!mobile || !password) {
        return res.status(400).json({ message: "Mobile number and password are required" });
      }

      const normalizedMobile = mobile.replace(/\s+/g, "").replace(/^(\+91|91)/, "");

      let allMatches = await db.select().from(crmUsers).where(
        eq(crmUsers.phone, normalizedMobile)
      );

      if (allMatches.length === 0 && normalizedMobile.length === 10) {
        allMatches = await db.select().from(crmUsers).where(
          eq(crmUsers.phone, `+91${normalizedMobile}`)
        );
      }

      if (allMatches.length === 0) {
        console.log(`[login] No user found for mobile ${normalizedMobile}`);
        return res.status(401).json({ message: "Invalid mobile number or password" });
      }

      console.log(`[login] Found ${allMatches.length} user(s) for mobile ${normalizedMobile}: ${allMatches.map(u => `id=${u.id}/t=${u.tenantId}`).join(", ")}`);

      const activeMatches = allMatches.filter(u => u.isActive && u.status === "Active" && u.passwordHash);
      if (activeMatches.length === 0) {
        const inactiveUser = allMatches.find(u => !u.isActive || u.status !== "Active");
        if (inactiveUser) {
          return res.status(403).json({ message: "Your account is inactive. Contact your administrator." });
        }
        return res.status(401).json({ message: "Password not set. Contact your administrator." });
      }

      const lockedUser = activeMatches.find(u => u.lockedUntil && new Date(u.lockedUntil) > new Date());
      if (lockedUser && activeMatches.length === 1) {
        const remainingMin = Math.ceil((new Date(lockedUser.lockedUntil!).getTime() - Date.now()) / 60000);
        return res.status(423).json({ message: `Account locked due to too many failed attempts. Try again in ${remainingMin} minute(s).` });
      }

      const ipKey = req.ip || "unknown";
      const ratEntry = LOGIN_RATE_LIMIT.get(ipKey);
      if (ratEntry && Date.now() < ratEntry.resetAt && ratEntry.count > 20) {
        return res.status(429).json({ message: "Too many login attempts from this IP. Please try again later." });
      }
      if (!ratEntry || Date.now() > ratEntry.resetAt) {
        LOGIN_RATE_LIMIT.set(ipKey, { count: 1, resetAt: Date.now() + 900000 });
      } else {
        ratEntry.count++;
      }

      for (const candidate of activeMatches) {
        if (candidate.lockedUntil && new Date(candidate.lockedUntil) > new Date()) continue;
        const isValid = await bcrypt.compare(password, candidate.passwordHash!);
        if (isValid) {
          await db.update(crmUsers).set({
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          }).where(eq(crmUsers.id, candidate.id));

          (req.session as any).crmUserId = candidate.id;
          (req.session as any).tenantId = candidate.tenantId;

          return req.session.save((err: any) => {
            if (err) {
              console.error("[login] Session save error:", err);
              return res.status(500).json({ message: "Login failed" });
            }
            console.log(`[login] Success: userId=${candidate.id}, tenantId=${candidate.tenantId}`);
            res.json({
              success: true,
              user: {
                id: String(candidate.id),
                name: candidate.name,
                email: candidate.email,
                phone: candidate.phone,
              },
            });
          });
        }
      }

      const firstActive = activeMatches[0];
      await db.update(crmUsers).set({
        failedLoginAttempts: sql`COALESCE(${crmUsers.failedLoginAttempts}, 0) + 1`,
      }).where(eq(crmUsers.id, firstActive.id));

      const [updated] = await db.select({ attempts: crmUsers.failedLoginAttempts }).from(crmUsers).where(eq(crmUsers.id, firstActive.id));
      const attempts = updated?.attempts || 1;
      console.log(`[login] Failed: userId=${firstActive.id}, attempts=${attempts}`);

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        await db.update(crmUsers).set({
          lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
        }).where(eq(crmUsers.id, firstActive.id));
        return res.status(423).json({ message: "Account locked due to too many failed attempts. Try again in 15 minutes." });
      }
      return res.status(401).json({ message: "Invalid mobile number or password" });
    } catch (error) {
      console.error("[login] Error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/admin-login", async (req, res) => {
    try {
      const { mobile, password } = req.body;
      if (!mobile || !password) {
        return res.status(400).json({ message: "Mobile number and password are required" });
      }

      const normalizedMobile = mobile.replace(/\s+/g, "").replace(/^(\+91|91)/, "");

      let allMatches = await db.select().from(crmUsers).where(eq(crmUsers.phone, normalizedMobile));

      if (allMatches.length === 0 && normalizedMobile.length === 10) {
        allMatches = await db.select().from(crmUsers).where(eq(crmUsers.phone, `+91${normalizedMobile}`));
      }

      const sysAdminMatches = allMatches.filter(u => u.systemRoleId !== null);
      const user: any = sysAdminMatches.length > 0
        ? sysAdminMatches.sort((a, b) => a.id - b.id)[0]
        : allMatches[0];

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        const remainingMin = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
        return res.status(423).json({ message: `Account locked. Try again in ${remainingMin} minute(s).` });
      }

      if (!user.isActive || user.status !== "Active") {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        const updateFields: any = { failedLoginAttempts: attempts };
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          updateFields.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        }
        await db.update(crmUsers).set(updateFields).where(eq(crmUsers.id, user.id));
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.systemRoleId) {
        return res.status(403).json({ message: "Access denied. System Administrator role required." });
      }

      const [role] = await db.select().from(systemRoles).where(eq(systemRoles.id, user.systemRoleId));
      if (!role || role.code !== "SYS_ADMIN") {
        return res.status(403).json({ message: "Access denied. System Administrator role required." });
      }

      await db.update(crmUsers).set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      }).where(eq(crmUsers.id, user.id));

      (req.session as any).crmUserId = user.id;
      (req.session as any).tenantId = user.tenantId;

      req.session.save((err: any) => {
        if (err) {
          console.error("Admin login session save error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({
          success: true,
          user: { id: String(user.id), name: user.name },
        });
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/setup-status", async (_req, res) => {
    try {
      const allUsers = await db.select().from(crmUsers);
      const hasAnyPassword = allUsers.some(u => u.passwordHash !== null);
      const adminUsers = allUsers.filter(u => u.systemRoleId !== null);
      res.json({ needsSetup: !hasAnyPassword && allUsers.length > 0, totalUsers: allUsers.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to check setup status" });
    }
  });

  app.post("/api/auth/initial-setup", async (req, res) => {
    try {
      const allUsers = await db.select().from(crmUsers);
      const hasAnyPassword = allUsers.some(u => u.passwordHash !== null);
      if (hasAnyPassword) {
        return res.status(403).json({ message: "Setup already completed. Use normal login." });
      }

      const { mobile, password } = req.body;
      if (!mobile || !password || password.length < 6) {
        return res.status(400).json({ message: "Mobile number and password (min 6 chars) required" });
      }

      const normalizedMobile = mobile.replace(/\s+/g, "").replace(/^(\+91|91)/, "");
      let user = allUsers.find(u => u.phone === normalizedMobile || u.phone === `+91${normalizedMobile}`);

      if (!user) {
        return res.status(404).json({ message: "No CRM user found with this mobile number. Contact your system administrator." });
      }

      const hash = await hashPassword(password);
      await db.update(crmUsers).set({ passwordHash: hash }).where(eq(crmUsers.id, user.id));

      (req.session as any).crmUserId = user.id;
      (req.session as any).tenantId = user.tenantId;

      req.session.save((err: any) => {
        if (err) return res.status(500).json({ message: "Setup failed" });
        res.json({ success: true, user: { id: user!.id, name: user!.name } });
      });
    } catch (error) {
      console.error("Initial setup error:", error);
      res.status(500).json({ message: "Setup failed" });
    }
  });

  app.post("/api/auth/switch-tenant", async (req, res) => {
    try {
      const crmUserId = (req.session as any).crmUserId;
      if (!crmUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const [currentUser] = await db.select().from(crmUsers).where(eq(crmUsers.id, crmUserId));
      if (!currentUser || !currentUser.systemRoleId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const [role] = await db.select().from(systemRoles).where(eq(systemRoles.id, currentUser.systemRoleId));
      if (!role || role.code !== "SYS_ADMIN") {
        return res.status(403).json({ message: "Only System Administrators can switch tenants" });
      }

      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const [targetTenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!targetTenant) {
        return res.status(404).json({ message: "Hospital not found" });
      }

      let [targetUser] = await db.select().from(crmUsers).where(
        and(eq(crmUsers.tenantId, tenantId), eq(crmUsers.phone, currentUser.phone!))
      );

      if (!targetUser) {
        const [anyAdmin] = await db.select().from(crmUsers).where(eq(crmUsers.tenantId, tenantId));
        if (!anyAdmin) {
          return res.status(404).json({ message: "No users found for this hospital" });
        }
        targetUser = anyAdmin;
      }

      (req.session as any).crmUserId = targetUser.id;
      (req.session as any).tenantId = tenantId;

      req.session.save((err: any) => {
        if (err) {
          return res.status(500).json({ message: "Failed to switch tenant" });
        }
        res.json({
          success: true,
          tenant: { id: targetTenant.id, name: targetTenant.name, displayName: targetTenant.displayName },
          user: { id: targetUser.id, name: targetUser.name },
        });
      });
    } catch (error) {
      console.error("Switch tenant error:", error);
      res.status(500).json({ message: "Failed to switch tenant" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.post("/api/auth/change-password", isAuthenticated, async (req, res) => {
    try {
      const crmUserId = (req.session as any).crmUserId;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const [user] = await db.select().from(crmUsers).where(eq(crmUsers.id, crmUserId));
      if (!user || !user.passwordHash) {
        return res.status(400).json({ message: "Unable to change password" });
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const hash = await hashPassword(newPassword);
      await db.update(crmUsers).set({ passwordHash: hash }).where(eq(crmUsers.id, crmUserId));

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.post("/api/auth/admin-reset-password", isAuthenticated, async (req, res) => {
    try {
      const crmUserId = (req.session as any).crmUserId;
      const tenantId = (req.session as any).tenantId;

      const [currentUser] = await db.select().from(crmUsers).where(eq(crmUsers.id, crmUserId));
      if (!currentUser || !currentUser.systemRoleId) {
        return res.status(403).json({ message: "Only administrators can reset passwords" });
      }
      const [role] = await db.select().from(systemRoles).where(eq(systemRoles.id, currentUser.systemRoleId));
      if (!role || !["SYS_ADMIN", "ADMIN"].includes(role.code)) {
        return res.status(403).json({ message: "Only administrators can reset passwords" });
      }

      const { userId, newPassword } = req.body;
      if (!userId || !newPassword) {
        return res.status(400).json({ message: "User ID and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const [targetUser] = await db.select().from(crmUsers).where(
        and(eq(crmUsers.id, Number(userId)), eq(crmUsers.tenantId, tenantId))
      );
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const hash = await hashPassword(newPassword);
      await db.update(crmUsers).set({
        passwordHash: hash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      }).where(eq(crmUsers.id, targetUser.id));

      res.json({ success: true, message: `Password reset for ${targetUser.name}` });
    } catch (error) {
      console.error("Admin reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { mobile } = req.body;
      if (!mobile) {
        return res.status(400).json({ message: "Mobile number is required" });
      }

      const normalizedMobile = mobile.replace(/\s+/g, "").replace(/^(\+91|91)/, "");

      const candidates = [];
      const found1 = await db.select().from(crmUsers).where(eq(crmUsers.phone, `+91${normalizedMobile}`));
      candidates.push(...found1);
      const found2 = await db.select().from(crmUsers).where(eq(crmUsers.phone, normalizedMobile));
      candidates.push(...found2);

      let user = candidates.find(u => u.tenantId) || candidates[0] || null;
      console.log(`[forgot-password] Found ${candidates.length} users for mobile ${normalizedMobile}, selected userId=${user?.id}, tenantId=${user?.tenantId}, email=${user?.email}`);

      if (!user) {
        return res.json({ success: true, message: "If an account with that mobile number exists, a reset link has been sent.", channel: "none" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000);

      await db.update(crmUsers)
        .set({ resetToken: token, resetTokenExpiry: expiry })
        .where(eq(crmUsers.id, user.id));

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const resetLink = `${baseUrl}/reset-password?token=${token}`;

      let hospitalName = "Hospital CRM";

      if (user.tenantId) {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId));
        if (tenant) {
          hospitalName = tenant.displayName || tenant.name;
        }
      }

      const userPhone = user.phone || `+91${normalizedMobile}`;

      if (isMSG91Configured()) {
        try {
          await sendPasswordResetSMS(userPhone, user.name, resetLink, hospitalName);
          const maskedPhone = userPhone.replace(/(\d{2})\d+(\d{2})$/, "$1******$2");
          return res.json({ success: true, message: "Password reset link has been sent to your registered mobile number.", phone: maskedPhone, channel: "sms" });
        } catch (smsErr: any) {
          console.error("[forgot-password] SMS send error, falling back to email:", smsErr.message);
        }
      }

      if (!user.email) {
        await db.update(crmUsers)
          .set({ resetToken: null, resetTokenExpiry: null })
          .where(eq(crmUsers.id, user.id));
        if (isMSG91Configured()) {
          return res.status(500).json({ message: "Unable to send reset link. Please contact your administrator." });
        }
        return res.json({ success: true, message: "If an account with that mobile number exists, a reset link has been sent.", channel: "none" });
      }

      let tenantSmtp: TenantSmtpConfig | null = null;

      if (user.tenantId) {
        const settings = await db.select({
          settingKey: tenantSettings.settingKey,
          settingValue: tenantSettings.settingValue,
        }).from(tenantSettings).where(eq(tenantSettings.tenantId, user.tenantId));

        const getSetting = (key: string) => settings.find(s => s.settingKey === key)?.settingValue || "";

        const smtpHost = getSetting("smtp_host");
        const smtpUser = getSetting("smtp_user");
        const smtpPass = getSetting("smtp_pass");

        if (smtpHost && smtpUser && smtpPass) {
          tenantSmtp = {
            smtpHost,
            smtpPort: parseInt(getSetting("smtp_port") || "587"),
            smtpUser,
            smtpPass,
            smtpFromEmail: getSetting("smtp_from_email") || smtpUser,
            smtpFromName: getSetting("smtp_from_name") || hospitalName,
            smtpSecure: getSetting("smtp_secure") !== "false",
          };
          console.log(`[forgot-password] Using tenant SMTP: host=${smtpHost}, port=${tenantSmtp.smtpPort}, user=${smtpUser}, passLen=${smtpPass.length}, from=${tenantSmtp.smtpFromEmail}`);
        } else {
          console.log(`[forgot-password] Tenant SMTP incomplete: host=${smtpHost || 'EMPTY'}, user=${smtpUser || 'EMPTY'}, pass=${smtpPass ? 'SET' : 'EMPTY'}. Falling back to global SMTP.`);
        }
      }

      try {
        await sendPasswordResetEmail(user.email, user.name, resetLink, tenantSmtp, hospitalName);
      } catch (emailErr: any) {
        console.error("Email send error:", emailErr);
        await db.update(crmUsers)
          .set({ resetToken: null, resetTokenExpiry: null })
          .where(eq(crmUsers.id, user.id));
        const detail = emailErr.message || "Unknown error";
        return res.status(500).json({ message: `Unable to send reset link: ${detail}` });
      }

      const maskedEmail = user.email.replace(/^(.{2})(.*)(@.*)$/, (_, start, middle, domain) => start + middle.replace(/./g, "*") + domain);
      res.json({ success: true, message: "Password reset link has been sent to your email.", email: maskedEmail, channel: "email" });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: "Token and new password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const [user] = await db.select().from(crmUsers).where(eq(crmUsers.resetToken, token));

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
      }

      if (!user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
        await db.update(crmUsers)
          .set({ resetToken: null, resetTokenExpiry: null })
          .where(eq(crmUsers.id, user.id));
        return res.status(400).json({ message: "Reset link has expired. Please request a new one." });
      }

      const hash = await hashPassword(password);
      await db.update(crmUsers)
        .set({ passwordHash: hash, resetToken: null, resetTokenExpiry: null })
        .where(eq(crmUsers.id, user.id));

      res.json({ success: true, message: "Password has been reset successfully. You can now log in." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password. Please try again." });
    }
  });

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const session = req.session as any;
      const crmUserId = session.crmUserId;

      const [user] = await db.select().from(crmUsers).where(eq(crmUsers.id, crmUserId));
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      res.json({
        id: String(user.id),
        email: user.email,
        firstName: user.name.split(" ")[0] || user.name,
        lastName: user.name.split(" ").slice(1).join(" ") || "",
        profileImageUrl: null,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

const LOGIN_RATE_LIMIT = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

async function tryLogin(user: any, password: string, req: any, res: any) {
  if (!user.isActive || user.status !== "Active") {
    return res.status(403).json({ message: "Your account is inactive. Contact your administrator." });
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remainingMin = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    return res.status(423).json({ message: `Account locked due to too many failed attempts. Try again in ${remainingMin} minute(s).` });
  }

  if (!user.passwordHash) {
    return res.status(401).json({ message: "Password not set. Contact your administrator to set your password." });
  }

  const ipKey = req.ip || "unknown";
  const ratEntry = LOGIN_RATE_LIMIT.get(ipKey);
  if (ratEntry && Date.now() < ratEntry.resetAt && ratEntry.count > 20) {
    return res.status(429).json({ message: "Too many login attempts from this IP. Please try again later." });
  }
  if (!ratEntry || Date.now() > ratEntry.resetAt) {
    LOGIN_RATE_LIMIT.set(ipKey, { count: 1, resetAt: Date.now() + 900000 });
  } else {
    ratEntry.count++;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const updateFields: any = { failedLoginAttempts: attempts };
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      updateFields.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }
    await db.update(crmUsers).set(updateFields).where(eq(crmUsers.id, user.id));
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      return res.status(423).json({ message: "Account locked due to too many failed attempts. Try again in 15 minutes." });
    }
    return res.status(401).json({ message: "Invalid mobile number or password" });
  }

  await db.update(crmUsers).set({
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
  }).where(eq(crmUsers.id, user.id));

  (req.session as any).crmUserId = user.id;
  (req.session as any).tenantId = user.tenantId;

  req.session.save((err: any) => {
    if (err) {
      console.error("Session save error:", err);
      return res.status(500).json({ message: "Login failed" });
    }
    res.json({
      success: true,
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const session = req.session as any;
  if (!session?.crmUserId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
