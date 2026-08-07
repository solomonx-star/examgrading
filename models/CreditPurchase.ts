import mongoose, { Schema, Model, Types } from "mongoose";

export interface ICreditPurchase {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  credits: number;
  amount: number; // minor units (e.g. 500 = NLe 5.00)
  checkoutSessionId: string;
  status: "pending" | "paid" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const CreditPurchaseSchema = new Schema<ICreditPurchase>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    credits: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    checkoutSessionId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

export const CreditPurchase: Model<ICreditPurchase> =
  (mongoose.models.CreditPurchase as Model<ICreditPurchase>) ||
  mongoose.model<ICreditPurchase>("CreditPurchase", CreditPurchaseSchema);
