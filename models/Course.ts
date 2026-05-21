import mongoose, { Schema, Model, Types } from "mongoose";

export type Semester = "First" | "Second" | "Summer";

export interface ICourse {
  _id: Types.ObjectId;
  name: string;
  code: string;
  department?: string;
  programmeId: Types.ObjectId;
  yearLevel: number;
  academicYear: string;
  semester: Semester;
  lecturerId?: Types.ObjectId;
  enrolledStudents: Types.ObjectId[];
  gradingRuleId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    department: { type: String, trim: true, index: true },
    programmeId: {
      type: Schema.Types.ObjectId,
      ref: "Programme",
      required: true,
      index: true,
    },
    yearLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    academicYear: { type: String, required: true, trim: true },
    semester: {
      type: String,
      enum: ["First", "Second", "Summer"],
      required: true,
    },
    lecturerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    enrolledStudents: [{ type: Schema.Types.ObjectId, ref: "User" }],
    gradingRuleId: { type: Schema.Types.ObjectId, ref: "GradingRule" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "courses" },
);

// Uniqueness within a period for a programme
CourseSchema.index(
  { code: 1, programmeId: 1, academicYear: 1, semester: 1 },
  { unique: true },
);

// Search and listing optimizations
CourseSchema.index({ department: 1, academicYear: 1, semester: 1 });
CourseSchema.index({ programmeId: 1, yearLevel: 1 });

export const Course: Model<ICourse> =
  (mongoose.models.Course as Model<ICourse>) ||
  mongoose.model<ICourse>("Course", CourseSchema);
