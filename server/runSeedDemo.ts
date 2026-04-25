/**
 * CLI wrapper for the RGB Demo Hospital seed.
 * Usage: npx tsx server/runSeedDemo.ts
 */

import { seedDemoTenant } from "./seedDemo";

async function main() {
  console.log("=== RGB Demo Hospital Seed CLI ===");
  try {
    const result = await seedDemoTenant();
    console.log("\n✓ Seed completed successfully");
    console.log("Message:", result.message);
    console.log("Stats:", JSON.stringify(result.stats, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error("\n✗ Seed failed:", err.message || err);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
