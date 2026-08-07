import mongoose, { Schema, Model, Types } from "mongoose";

export interface IAICredit {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

const AICreditSchema = new Schema<IAICredit>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balance: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

export const AICredit: Model<IAICredit> =
  (mongoose.models.AICredit as Model<IAICredit>) ||
  mongoose.model<IAICredit>("AICredit", AICreditSchema);
