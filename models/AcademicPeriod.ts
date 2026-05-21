import mongoose, { Schema, Model, Types } from "mongoose";
import type { Semester } from "./Course";

export interface IAcademicPeriod {
  _id: Types.ObjectId;
  year: string;
  semester: Semester;
  isCurrent: boolean;
  startDate: Date;
  endDate: Date;
  /**
   * Fee a student must pay (in NLe / SLE major units) to access the system
   * for this period. 0 means access is free for this period.
   */
  accessFee: number;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicPeriodSchema = new Schema<IAcademicPeriod>(
  {
    year: { type: String, required: true, trim: true },
    semester: {
      type: String,
      enum: ["First", "Second", "Summer"],
      required: true,
    },
    isCurrent: { type: Boolean, default: false, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    accessFee: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

AcademicPeriodSchema.index({ year: 1, semester: 1 }, { unique: true });

// Enforce a single isCurrent: true at all times
AcademicPeriodSchema.pre("save", async function () {
  if (!this.isCurrent) return;
  const Col = mongoose.models.AcademicPeriod as
    | Model<IAcademicPeriod>
    | undefined;
  if (Col) {
    await Col.updateMany(
      { _id: { $ne: this._id }, isCurrent: true },
      { $set: { isCurrent: false } },
    );
  }
});

export const AcademicPeriod: Model<IAcademicPeriod> =
  (mongoose.models.AcademicPeriod as Model<IAcademicPeriod>) ||
  mongoose.model<IAcademicPeriod>("AcademicPeriod", AcademicPeriodSchema);
