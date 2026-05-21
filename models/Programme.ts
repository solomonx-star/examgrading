import mongoose, { Schema, Model, Types } from "mongoose";

export interface IProgramme {
  _id: Types.ObjectId;
  name: string;
  code: string;
  department: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProgrammeSchema = new Schema<IProgramme>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
    },
    department: { type: String, required: true, trim: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Programme: Model<IProgramme> =
  (mongoose.models.Programme as Model<IProgramme>) ||
  mongoose.model<IProgramme>("Programme", ProgrammeSchema);
