import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { db } from "../../db";
import { crmUsers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
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

      const [user] = await db.select().from(crmUsers).where(
        eq(crmUsers.phone, normalizedMobile)
      );

      if (!user && normalizedMobile.length === 10) {
        const [userWithPrefix] = await db.select().from(crmUsers).where(
          eq(crmUsers.phone, `+91${normalizedMobile}`)
        );
        if (userWithPrefix) {
          return await tryLogin(userWithPrefix, password, req, res);
        }
      }

      if (!user) {
        return res.status(401).json({ message: "Invalid mobile number or password" });
      }

      return await tryLogin(user, password, req, res);
    } catch (error) {
      console.error("Login error:", error);
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

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
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

async function tryLogin(user: any, password: string, req: any, res: any) {
  if (!user.isActive || user.status !== "Active") {
    return res.status(403).json({ message: "Your account is inactive. Contact your administrator." });
  }

  if (!user.passwordHash) {
    return res.status(401).json({ message: "Password not set. Contact your administrator to set your password." });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ message: "Invalid mobile number or password" });
  }

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
