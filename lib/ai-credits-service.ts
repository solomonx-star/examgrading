import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { AICredit } from "@/models/AICredit";
import {
  AICreditTransaction,
  type AICreditReason,
} from "@/models/AICreditTransaction";

export type { AICreditReason };

export async function getBalance(studentId: string): Promise<number> {
  if (!mongoose.Types.ObjectId.isValid(studentId)) return 0;
  await connectDB();
  const doc = await AICredit.findOne({ student: studentId }).lean();
  return doc?.balance ?? 0;
}

export async function topUpCredits(args: {
  studentId: string;
  amount: number;
  note?: string;
  actorId: string | null;
  reason?: AICreditReason;
}): Promise<number> {
  if (!mongoose.Types.ObjectId.isValid(args.studentId))
    throw new Error("Invalid student id");
  if (!Number.isInteger(args.amount) || args.amount <= 0)
    throw new Error("Amount must be a positive whole number");

  await connectDB();
  const doc = await AICredit.findOneAndUpdate(
    { student: args.studentId },
    {
      $inc: { balance: args.amount },
      $setOnInsert: { student: new mongoose.Types.ObjectId(args.studentId) },
    },
    { new: true, upsert: true },
  );

  await AICreditTransaction.create({
    student: args.studentId,
    delta: args.amount,
    balanceAfter: doc.balance,
    reason: (args.reason ?? "topup.manual") satisfies AICreditReason,
    note: args.note ?? "",
    actorId: args.actorId
      ? new mongoose.Types.ObjectId(args.actorId)
      : null,
  });

  return doc.balance;
}

/**
 * Atomically deducts `amount` credits from the student's balance.
 * Throws if the balance is insufficient — callers must check before spending.
 */
export async function deductCredits(args: {
  studentId: string;
  amount: number;
  reason: AICreditReason;
  note?: string;
}): Promise<number> {
  if (!mongoose.Types.ObjectId.isValid(args.studentId))
    throw new Error("Invalid student id");
  if (!Number.isInteger(args.amount) || args.amount <= 0)
    throw new Error("Amount must be a positive whole number");

  await connectDB();
  const doc = await AICredit.findOneAndUpdate(
    { student: args.studentId, balance: { $gte: args.amount } },
    { $inc: { balance: -args.amount } },
    { new: true },
  );

  if (!doc) {
    const current = await getBalance(args.studentId);
    throw new Error(
      `Insufficient credits. You have ${current} but need ${args.amount}.`,
    );
  }

  await AICreditTransaction.create({
    student: args.studentId,
    delta: -args.amount,
    balanceAfter: doc.balance,
    reason: args.reason,
    note: args.note ?? "",
    actorId: null,
  });

  return doc.balance;
}

export type CreditTransactionView = {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: AICreditReason;
  note: string;
  createdAt: Date;
};

export async function getTransactions(
  studentId: string,
  limit = 30,
): Promise<CreditTransactionView[]> {
  if (!mongoose.Types.ObjectId.isValid(studentId)) return [];
  await connectDB();
  const docs = await AICreditTransaction.find({ student: studentId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return docs.map((d) => ({
    id: String(d._id),
    delta: d.delta,
    balanceAfter: d.balanceAfter,
    reason: d.reason as AICreditReason,
    note: d.note,
    createdAt: d.createdAt,
  }));
}
