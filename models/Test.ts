import mongoose, { Schema, Model, Types } from "mongoose";
import type { Semester } from "./Course";

export type TestQuestionType = "mcq" | "true_false" | "multi";

export interface ITestOption {
  _id: Types.ObjectId;
  text: string;
  isCorrect: boolean;
}

export interface ITestQuestion {
  _id: Types.ObjectId;
  type: TestQuestionType;
  prompt: string;
  options: ITestOption[];
  points: number;
}

export interface ITest {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  lecturerId: Types.ObjectId;
  title: string;
  description?: string;
  academicYear: string;
  semester: Semester;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  isPublished: boolean;
  publishedAt?: Date;
  sourcePdfUrl?: string;
  sourcePdfName?: string;
  questions: ITestQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

const TestOptionSchema = new Schema<ITestOption>(
  {
    text: { type: String, required: true, trim: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: true },
);

const TestQuestionSchema = new Schema<ITestQuestion>(
  {
    type: {
      type: String,
      enum: ["mcq", "true_false", "multi"],
      required: true,
    },
    prompt: { type: String, required: true, trim: true },
    options: {
      type: [TestOptionSchema],
      default: [],
      validate: {
        validator: (v: ITestOption[]) => Array.isArray(v) && v.length >= 2,
        message: "A question must have at least two options.",
      },
    },
    points: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: true },
);

const TestSchema = new Schema<ITest>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    lecturerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    academicYear: { type: String, required: true, trim: true },
    semester: {
      type: String,
      enum: ["First", "Second", "Summer"],
      required: true,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 1, max: 600 },
    isPublished: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date },
    sourcePdfUrl: { type: String, trim: true },
    sourcePdfName: { type: String, trim: true },
    questions: { type: [TestQuestionSchema], default: [] },
  },
  { timestamps: true },
);

TestSchema.index({ courseId: 1, isPublished: 1 });
TestSchema.index({ courseId: 1, startsAt: 1 });

export const Test: Model<ITest> =
  (mongoose.models.Test as Model<ITest>) ||
  mongoose.model<ITest>("Test", TestSchema);
