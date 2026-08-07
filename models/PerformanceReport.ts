import mongoose, { Schema, Model, Types } from "mongoose";

export interface IPerformanceReport {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  content: string;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PerformanceReportSchema = new Schema<IPerformanceReport>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: { type: String, required: true },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

PerformanceReportSchema.index({ studentId: 1, generatedAt: -1 });

export const PerformanceReport: Model<IPerformanceReport> =
  (mongoose.models.PerformanceReport as Model<IPerformanceReport>) ||
  mongoose.model<IPerformanceReport>(
    "PerformanceReport",
    PerformanceReportSchema,
  );
