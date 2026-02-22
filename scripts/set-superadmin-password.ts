import { db } from "../server/db";
import { crmUsers } from "../shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../server/replit_integrations/auth/replitAuth";

async function main() {
  const newPassword = process.argv[2];
  if (!newPassword || newPassword.length < 6) {
    console.error("Usage: npx tsx scripts/set-superadmin-password.ts <new_password>");
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const [superAdmin] = await db.select().from(crmUsers).where(eq(crmUsers.code, "SUPERADMIN"));
  if (!superAdmin) {
    console.error("SUPERADMIN user not found in the database.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(crmUsers).set({ passwordHash, modifiedAt: new Date() }).where(eq(crmUsers.id, superAdmin.id));

  console.log(`Password updated successfully for Super Admin (${superAdmin.name}, phone: ${superAdmin.phone}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
