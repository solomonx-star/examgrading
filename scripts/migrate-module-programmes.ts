/* eslint-disable no-console */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

/**
 * One-off backfill for the move from `programmeId` (single) to `programmeIds`
 * (array) on the `courses` collection. Run once per environment:
 *
 *   npx tsx scripts/migrate-module-programmes.ts
 *
 * Steps:
 *   1. For every course document that still has `programmeId` and no
 *      `programmeIds`, copy the value into a one-element array.
 *   2. Unset the obsolete `programmeId` field.
 *   3. Sync indexes — the old unique index { code, programmeId, year, sem }
 *      gets dropped and the new { code, year, sem } unique index is created.
 *
 * Safe to re-run: rows that already have programmeIds are skipped.
 */
async function run() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection");
  const courses = db.collection("courses");

  const needsBackfill = await courses.countDocuments({
    programmeId: { $exists: true },
    $or: [{ programmeIds: { $exists: false } }, { programmeIds: { $size: 0 } }],
  });
  console.log(`Found ${needsBackfill} course(s) needing backfill.`);

  if (needsBackfill > 0) {
    const cursor = courses.find({
      programmeId: { $exists: true },
      $or: [
        { programmeIds: { $exists: false } },
        { programmeIds: { $size: 0 } },
      ],
    });
    let migrated = 0;
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) break;
      await courses.updateOne(
        { _id: doc._id },
        { $set: { programmeIds: [doc.programmeId] } },
      );
      migrated += 1;
    }
    console.log(`Backfilled programmeIds on ${migrated} course(s).`);
  }

  // Drop the legacy programmeId field across the collection (a no-op if none
  // remain).
  const cleared = await courses.updateMany(
    { programmeId: { $exists: true } },
    { $unset: { programmeId: "" } },
  );
  console.log(`Cleared legacy programmeId field on ${cleared.modifiedCount} doc(s).`);

  // Detect duplicate (code, academicYear, semester) tuples — these would
  // break the new unique index. Caller must merge them by hand.
  const dupes = await courses
    .aggregate([
      {
        $group: {
          _id: {
            code: "$code",
            academicYear: "$academicYear",
            semester: "$semester",
          },
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  if (dupes.length) {
    console.warn(
      `\n⚠ Found ${dupes.length} (code, academicYear, semester) tuple(s) with multiple documents.`,
    );
    console.warn(
      "The new unique index requires these to be merged into one shared module before sync-indexes can run.",
    );
    for (const d of dupes) {
      console.warn(
        `  ${d._id.code} · ${d._id.academicYear} · ${d._id.semester} → ${d.ids.length} docs (${d.ids.map(String).join(", ")})`,
      );
    }
    console.warn(
      "\nNo indexes were synced. Resolve duplicates, then run: npx tsx scripts/sync-indexes.ts",
    );
  } else {
    const { Course } = await import("@/models/Course");
    const dropped = await Course.syncIndexes();
    if (dropped.length) {
      console.log(`Synced courses indexes (dropped: ${dropped.join(", ")}).`);
    } else {
      console.log("Course indexes already in sync.");
    }
  }

  await mongoose.disconnect();
  console.log("\n✓ Migration complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
