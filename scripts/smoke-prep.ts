/* eslint-disable no-console */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Course } from "@/models/Course";

async function run() {
  await connectDB();
  await User.updateMany(
    {
      email: {
        $in: [
          "admin.aminata@iamco.edu.sl",
          "student.abdul@iamco.edu.sl",
          "lecturer.fatmata@iamco.edu.sl",
        ],
      },
    },
    { $set: { mustChangePassword: false } },
  );

  const admin = await User.findOne({ email: "admin.aminata@iamco.edu.sl" })
    .select("_id")
    .lean();
  const student = await User.findOne({ email: "student.abdul@iamco.edu.sl" })
    .select("_id department programmeId yearLevel")
    .lean();
  const module_ = await Course.findOne({}).select("_id department").lean();

  // pick a module the student is enrolled in
  const studentModule = student
    ? await Course.findOne({ enrolledStudents: student._id })
        .select("_id")
        .lean()
    : null;

  console.log(JSON.stringify({
    adminId: admin && String(admin._id),
    studentId: student && String(student._id),
    studentProgrammeId: student?.programmeId && String(student.programmeId),
    studentYearLevel: student?.yearLevel,
    anyModuleId: module_ && String(module_._id),
    studentModuleId: studentModule && String(studentModule._id),
  }, null, 2));
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
