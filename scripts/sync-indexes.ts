/* eslint-disable no-console */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Programme } from "@/models/Programme";
import { Course } from "@/models/Course";
import { Grade } from "@/models/Grade";
import { Attendance } from "@/models/Attendance";
import { GradingRule } from "@/models/GradingRule";
import { AcademicPeriod } from "@/models/AcademicPeriod";

// Drops any indexes that exist in MongoDB but are no longer in the Mongoose
// schema definitions (e.g. left over from a renamed field). Safe to re-run.
async function run() {
  await connectDB();
  console.log(`Connected to ${mongoose.connection.name}`);

  const models = [
    User,
    Programme,
    Course,
    Grade,
    Attendance,
    GradingRule,
    AcademicPeriod,
  ];

  for (const M of models) {
    const dropped = await M.syncIndexes();
    if (dropped.length === 0) {
      console.log(`  ${M.collection.name}: in sync`);
    } else {
      console.log(`  ${M.collection.name}: dropped → ${dropped.join(", ")}`);
    }
  }

  await mongoose.disconnect();
  console.log("\n✓ Index sync complete");
}

run().catch((e) => {
  console.error("sync-indexes failed:", e);
  process.exit(1);
});
