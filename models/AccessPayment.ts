import mongoose, { Schema, Model, Types } from "mongoose";
import type { Semester } from "./Course";

/**
 * A student's payment for system access during one academic period. Mirrors
 * PlanPayment in the reference backend (collegemanagementsystembackend-main)
 * but at student/period granularity.
 *
 *   channel 'online'  → paid via Monime (card / mobile money), status driven
 *                       by verify + webhook.
 *   channel 'manual'  → cash / bank transfer recorded by an admin.
 */
export type AccessPaymentMethod =
  | "card"
  | "mobile_money"
  | "bank_transfer"
  | "cash";
export type AccessPaymentChannel = "online" | "manual";
export type AccessPaymentStatus = "pending" | "completed" | "failed";

export interface IAccessPayment {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  period: Types.ObjectId;
  academicYear: string;
  semester: Semester;
  amount: number;
  method: AccessPaymentMethod;
  channel: AccessPaymentChannel;
  status: AccessPaymentStatus;
  reference: string;
  monimeSessionId: string | null;
  receiptNumber: string | null;
  recordedBy: Types.ObjectId | null;
  note: string;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AccessPaymentSchema = new Schema<IAccessPayment>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    period: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    academicYear: { type: String, required: true, trim: true },
    semester: {
      type: String,
      enum: ["First", "Second", "Summer"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ["card", "mobile_money", "bank_transfer", "cash"],
      required: true,
    },
    channel: {
      type: String,
      enum: ["online", "manual"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    reference: { type: String, default: "" },
    monimeSessionId: { type: String, default: null },
    receiptNumber: { type: String, default: null },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    note: { type: String, default: "" },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

AccessPaymentSchema.index({ student: 1, period: 1, status: 1 });
AccessPaymentSchema.index({ createdAt: -1 });
AccessPaymentSchema.index(
  { monimeSessionId: 1 },
  { unique: true, sparse: true },
);
AccessPaymentSchema.index(
  { receiptNumber: 1 },
  { unique: true, sparse: true },
);

export const AccessPayment: Model<IAccessPayment> =
  (mongoose.models.AccessPayment as Model<IAccessPayment>) ||
  mongoose.model<IAccessPayment>("AccessPayment", AccessPaymentSchema);
