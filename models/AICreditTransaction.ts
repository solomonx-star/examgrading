import mongoose, { Schema, Model, Types } from "mongoose";

export type AICreditReason =
  | "topup.manual"
  | "topup.purchase"
  | "spend.tutor"
  | "spend.practice_test"
  | "spend.performance_report"
  | "spend.study_plan";

export const CREDIT_REASON_LABELS: Record<AICreditReason, string> = {
  "topup.manual": "Top-up (admin)",
  "topup.purchase": "Credit purchase",
  "spend.tutor": "AI Tutor session",
  "spend.practice_test": "Practice test",
  "spend.performance_report": "Performance report",
  "spend.study_plan": "Study plan",
};

export interface IAICreditTransaction {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  delta: number;
  balanceAfter: number;
  reason: AICreditReason;
  note: string;
  actorId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AICreditTransactionSchema = new Schema<IAICreditTransaction>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      enum: [
        "topup.manual",
        "topup.purchase",
        "spend.tutor",
        "spend.practice_test",
        "spend.performance_report",
        "spend.study_plan",
      ],
      required: true,
    },
    note: { type: String, default: "" },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

AICreditTransactionSchema.index({ student: 1, createdAt: -1 });

export const AICreditTransaction: Model<IAICreditTransaction> =
  (mongoose.models.AICreditTransaction as Model<IAICreditTransaction>) ||
  mongoose.model<IAICreditTransaction>(
    "AICreditTransaction",
    AICreditTransactionSchema,
  );
