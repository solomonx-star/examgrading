import mongoose, { Schema, Model, Types } from "mongoose";

export interface IGradeBand {
  min: number;
  max: number;
  grade: string;
  gpa: number;
  remark: string;
}

export interface IGradingRule {
  _id: Types.ObjectId;
  name: string;
  courseId: Types.ObjectId | null;
  caWeight: number;
  examWeight: number;
  attendanceThreshold: number;
  gradeScale: IGradeBand[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GradeBandSchema = new Schema<IGradeBand>(
  {
    min: { type: Number, required: true, min: 0, max: 100 },
    max: { type: Number, required: true, min: 0, max: 100 },
    grade: { type: String, required: true, trim: true, uppercase: true },
    gpa: { type: Number, required: true, min: 0, max: 4 },
    remark: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const GradingRuleSchema = new Schema<IGradingRule>(
  {
    name: { type: String, required: true, trim: true },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      default: null,
      index: true,
    },
    caWeight: { type: Number, required: true, min: 0, max: 100 },
    examWeight: { type: Number, required: true, min: 0, max: 100 },
    attendanceThreshold: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    gradeScale: {
      type: [GradeBandSchema],
      required: true,
      validate: {
        validator: (v: IGradeBand[]) => v.length > 0,
        message: "gradeScale must contain at least one band",
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

GradingRuleSchema.pre("validate", function () {
  if (this.caWeight + this.examWeight !== 100) {
    throw new Error("caWeight + examWeight must equal 100");
  }
});

export const GradingRule: Model<IGradingRule> =
  (mongoose.models.GradingRule as Model<IGradingRule>) ||
  mongoose.model<IGradingRule>("GradingRule", GradingRuleSchema);
