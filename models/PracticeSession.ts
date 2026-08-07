import mongoose, { Schema, Model, Types } from "mongoose";

export interface IPracticeQuestion {
  id: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correctId: string;
  explanation: string;
}

export interface IPracticeSession {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  difficulty: "easy" | "mixed" | "challenging";
  questions: IPracticeQuestion[];
  answers: Map<string, string>;
  score: number | null;
  maxScore: number;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeQuestionSchema = new Schema<IPracticeQuestion>(
  {
    id: { type: String, required: true },
    prompt: { type: String, required: true },
    options: [
      {
        id: { type: String, required: true },
        text: { type: String, required: true },
      },
    ],
    correctId: { type: String, required: true },
    explanation: { type: String, default: "" },
  },
  { _id: false },
);

const PracticeSessionSchema = new Schema<IPracticeSession>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "mixed", "challenging"],
      required: true,
    },
    questions: { type: [PracticeQuestionSchema], required: true },
    answers: { type: Map, of: String, default: () => new Map() },
    score: { type: Number, default: null },
    maxScore: { type: Number, required: true },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

PracticeSessionSchema.index({ studentId: 1, createdAt: -1 });

export const PracticeSession: Model<IPracticeSession> =
  (mongoose.models.PracticeSession as Model<IPracticeSession>) ||
  mongoose.model<IPracticeSession>("PracticeSession", PracticeSessionSchema);
