import { db } from "../server/db";
import { leads, activities, episodes } from "../shared/schema";
import { inArray, count } from "drizzle-orm";

const BAD_IDS = [5378, 5379, 5380, 5381, 5382, 5383, 5384, 5385, 5386];
const DRY_RUN = !process.argv.includes("--execute");

async function main() {
  console.log(`\n=== Meta Lead Cleanup (${DRY_RUN ? "DRY RUN" : "EXECUTE"}) ===`);
  console.log(`Target IDs: ${BAD_IDS.join(", ")}`);

  const existing = await db
    .select({ id: leads.id, name: leads.name, phoneE164: leads.phoneE164 })
    .from(leads)
    .where(inArray(leads.id, BAD_IDS));

  if (existing.length === 0) {
    console.log("No matching leads found — already cleaned up or IDs don't exist in this environment.");
    process.exit(0);
  }

  console.log(`\nFound ${existing.length} lead(s) to evaluate:`);
  for (const l of existing) {
    console.log(`  ID ${l.id}: ${l.name} | ${l.phoneE164}`);
  }

  const presentIds = existing.map(l => l.id);

  const [actRow] = await db
    .select({ cnt: count() })
    .from(activities)
    .where(inArray(activities.leadId, presentIds));
  const actCount = Number(actRow?.cnt ?? 0);

  const [epRow] = await db
    .select({ cnt: count() })
    .from(episodes)
    .where(inArray(episodes.leadId, presentIds));
  const epCount = Number(epRow?.cnt ?? 0);

  console.log(`\nDownstream references:`);
  console.log(`  Activities : ${actCount}`);
  console.log(`  Episodes   : ${epCount}`);

  if (actCount > 0 || epCount > 0) {
    console.error("\nABORTED: downstream references found — leads are not safe to delete.");
    process.exit(1);
  }

  console.log("\nNo downstream references found — safe to delete.");

  if (DRY_RUN) {
    console.log("\nDry run complete. Re-run with --execute to perform the deletion.");
    process.exit(0);
  }

  const deleted = await db
    .delete(leads)
    .where(inArray(leads.id, presentIds))
    .returning({ id: leads.id });

  console.log(`\nDeleted ${deleted.length} lead(s): IDs ${deleted.map(r => r.id).join(", ")}`);
  console.log("Cleanup complete.");
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
