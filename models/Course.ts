import mongoose, { Schema, Model, Types } from "mongoose";

export type Semester = "First" | "Second" | "Summer";

export interface ICourse {
  _id: Types.ObjectId;
  name: string;
  code: string;
  department?: string;
  programmeIds: Types.ObjectId[];
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
    programmeIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Programme" }],
      required: true,
      default: [],
      index: true,
      validate: {
        validator: (v: Types.ObjectId[]) => Array.isArray(v) && v.length >= 1,
        message: "A module must be attached to at least one programme.",
      },
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

// One module record per (code, period). Programmes that share the module
// reference the same document via programmeIds.
CourseSchema.index(
  { code: 1, academicYear: 1, semester: 1 },
  { unique: true },
);

CourseSchema.index({ department: 1, academicYear: 1, semester: 1 });
CourseSchema.index({ programmeIds: 1, yearLevel: 1 });

export const Course: Model<ICourse> =
  (mongoose.models.Course as Model<ICourse>) ||
  mongoose.model<ICourse>("Course", CourseSchema);
