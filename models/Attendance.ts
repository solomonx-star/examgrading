import mongoose, { Schema, Model, Types } from "mongoose";
import type { Semester } from "./Course";

export type AttendanceStatus = "present" | "absent" | "late";

export interface IAttendance {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  studentId: Types.ObjectId;
  lecturerId: Types.ObjectId;
  date: Date;
  status: AttendanceStatus;
  semester: Semester;
  academicYear: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lecturerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["present", "absent", "late"],
      required: true,
    },
    semester: {
      type: String,
      enum: ["First", "Second", "Summer"],
      required: true,
    },
    academicYear: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

// One attendance record per student per course per day
AttendanceSchema.index(
  { courseId: 1, studentId: 1, date: 1 },
  { unique: true },
);

export const Attendance: Model<IAttendance> =
  (mongoose.models.Attendance as Model<IAttendance>) ||
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);
