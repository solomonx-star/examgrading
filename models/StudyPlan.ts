import mongoose, { Schema, Model, Types } from "mongoose";

export interface IStudyDay {
  date: string;
  dayOfWeek: string;
  moduleCode: string;
  moduleName: string;
  activity: string;
  priority: "high" | "medium" | "low";
}

export interface IStudyPlanInput {
  hoursPerDay: number;
  studyDays: string[];
  upcomingTests: Array<{ title: string; moduleCode: string; date: string }>;
}

export interface IStudyPlan {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  plan: IStudyDay[];
  generatedAt: Date;
  inputSnapshot: IStudyPlanInput;
  createdAt: Date;
  updatedAt: Date;
}

const StudyDaySchema = new Schema<IStudyDay>(
  {
    date: { type: String, required: true },
    dayOfWeek: { type: String, required: true },
    moduleCode: { type: String, required: true },
    moduleName: { type: String, required: true },
    activity: { type: String, required: true },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      required: true,
    },
  },
  { _id: false },
);

const StudyPlanSchema = new Schema<IStudyPlan>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: { type: [StudyDaySchema], required: true },
    generatedAt: { type: Date, required: true },
    inputSnapshot: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

StudyPlanSchema.index({ studentId: 1, generatedAt: -1 });

export const StudyPlan: Model<IStudyPlan> =
  (mongoose.models.StudyPlan as Model<IStudyPlan>) ||
  mongoose.model<IStudyPlan>("StudyPlan", StudyPlanSchema);
