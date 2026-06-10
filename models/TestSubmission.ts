import mongoose, { Schema, Model, Types } from "mongoose";

export type TestSubmissionStatus = "in_progress" | "submitted";

export interface ITestSubmissionAnswer {
  _id: Types.ObjectId;
  questionId: Types.ObjectId;
  selectedOptionIds: Types.ObjectId[];
  awardedPoints: number;
}

export interface ITestSubmission {
  _id: Types.ObjectId;
  testId: Types.ObjectId;
  courseId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: TestSubmissionStatus;
  startedAt: Date;
  submittedAt?: Date;
  answers: ITestSubmissionAnswer[];
  score: number;
  maxScore: number;
  percentage: number;
  createdAt: Date;
  updatedAt: Date;
}

const TestSubmissionAnswerSchema = new Schema<ITestSubmissionAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    selectedOptionIds: [{ type: Schema.Types.ObjectId }],
    awardedPoints: { type: Number, default: 0, min: 0 },
  },
  { _id: true },
);

const TestSubmissionSchema = new Schema<ITestSubmission>(
  {
    testId: {
      type: Schema.Types.ObjectId,
      ref: "Test",
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["in_progress", "submitted"],
      default: "in_progress",
      required: true,
    },
    startedAt: { type: Date, required: true, default: () => new Date() },
    submittedAt: { type: Date },
    answers: { type: [TestSubmissionAnswerSchema], default: [] },
    score: { type: Number, default: 0, min: 0 },
    maxScore: { type: Number, default: 0, min: 0 },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true },
);

// One submission record per (test, student) — enforces the "one attempt" rule.
TestSubmissionSchema.index({ testId: 1, studentId: 1 }, { unique: true });

export const TestSubmission: Model<ITestSubmission> =
  (mongoose.models.TestSubmission as Model<ITestSubmission>) ||
  mongoose.model<ITestSubmission>("TestSubmission", TestSubmissionSchema);
