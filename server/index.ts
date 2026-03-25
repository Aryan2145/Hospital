import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, runDeferredStartupTasks } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startBackgroundScheduler } from "./services/backgroundScheduler";

const PHI_FIELDS = new Set([
  "phoneE164", "phone_e164", "mobileNormalized", "mobile_normalized",
  "email", "phone", "primaryPhone", "primary_phone", "secondaryPhone", "secondary_phone",
  "diagnosis", "treatmentPlan", "treatment_plan", "consultationNotes", "consultation_notes",
  "insuranceProvider", "insurance_provider", "insurancePolicyNumber", "insurance_policy_number",
  "bloodGroup", "blood_group", "dateOfBirth", "date_of_birth",
  "address", "pinCode", "pin_code", "emergencyContactName", "emergency_contact_name",
  "emergencyContactPhone", "emergency_contact_phone", "passwordHash", "password_hash",
  "resetToken", "reset_token", "notes",
]);

function sanitizeForLog(obj: any, depth = 0): any {
  if (depth > 3 || obj == null) return obj;
  if (Array.isArray(obj)) {
    if (obj.length > 3) return `[Array(${obj.length})]`;
    return obj.map(item => sanitizeForLog(item, depth + 1));
  }
  if (typeof obj === "object") {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (PHI_FIELDS.has(key) && value) {
        result[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        result[key] = sanitizeForLog(value, depth + 1);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return obj;
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.get("/_health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const sanitized = sanitizeForLog(capturedJsonResponse);
        const responseStr = JSON.stringify(sanitized);
        logLine += ` :: ${responseStr.length > 200 ? responseStr.substring(0, 200) + '...' : responseStr}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });

    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    const port = parseInt(process.env.PORT || "5001");
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
      },
      () => {
        log(`serving on port ${port}`);

        startBackgroundScheduler();

        runDeferredStartupTasks().catch(err =>
          console.error("[deferred-startup] Fatal:", err)
        );
      },
    );
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
