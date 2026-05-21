import mongoose, { Schema, Model, Types } from "mongoose";
import type { Semester } from "./Course";

export type SubmissionStatus = "draft" | "submitted";

export interface IGrade {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  studentId: Types.ObjectId;
  lecturerId: Types.ObjectId;
  testScore: number;
  testMaxScore: number;
  examScore: number;
  examMaxScore: number;
  calculatedScore?: number;
  calculatedGrade?: string;
  calculatedGPA?: number;
  calculatedRemark?: string;
  attendanceMet?: boolean;
  semester: Semester;
  academicYear: string;
  submissionStatus: SubmissionStatus;
  submittedAt?: Date;
  submittedBy?: Types.ObjectId;
  isPublished: boolean;
  publishedAt?: Date;
  publishedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GradeSchema = new Schema<IGrade>(
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
    testScore: { type: Number, default: 0, min: 0 },
    testMaxScore: { type: Number, default: 100, min: 1 },
    examScore: { type: Number, default: 0, min: 0 },
    examMaxScore: { type: Number, default: 100, min: 1 },
    calculatedScore: { type: Number, min: 0, max: 100 },
    calculatedGrade: { type: String, trim: true, uppercase: true },
    calculatedGPA: { type: Number, min: 0, max: 4 },
    calculatedRemark: { type: String, trim: true },
    attendanceMet: { type: Boolean },
    semester: {
      type: String,
      enum: ["First", "Second", "Summer"],
      required: true,
    },
    academicYear: { type: String, required: true, trim: true },
    submissionStatus: {
      type: String,
      enum: ["draft", "submitted"],
      default: "draft",
      required: true,
      index: true,
    },
    submittedAt: { type: Date },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isPublished: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

GradeSchema.index(
  { courseId: 1, studentId: 1, academicYear: 1, semester: 1 },
  { unique: true },
);

// Drives the admin cohort-review queries
// ("show me everything submitted-but-unpublished in this period").
GradeSchema.index({
  academicYear: 1,
  semester: 1,
  submissionStatus: 1,
  isPublished: 1,
});

export const Grade: Model<IGrade> =
  (mongoose.models.Grade as Model<IGrade>) ||
  mongoose.model<IGrade>("Grade", GradeSchema);
