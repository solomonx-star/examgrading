import mongoose, { Schema, Model, Types } from "mongoose";

export interface ITutorMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface ITutorSession {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  courseId: Types.ObjectId;
  moduleCode: string;
  moduleName: string;
  programmeName: string;
  yearLevel: number;
  messages: ITutorMessage[];
  creditsCost: number;
  createdAt: Date;
  updatedAt: Date;
}

const TutorMessageSchema = new Schema<ITutorMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const TutorSessionSchema = new Schema<ITutorSession>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    moduleCode: { type: String, required: true },
    moduleName: { type: String, required: true },
    programmeName: { type: String, default: "" },
    yearLevel: { type: Number, default: 1 },
    messages: { type: [TutorMessageSchema], default: [] },
    creditsCost: { type: Number, required: true, default: 5 },
  },
  { timestamps: true },
);

TutorSessionSchema.index({ student: 1, courseId: 1, createdAt: -1 });

export const TutorSession: Model<ITutorSession> =
  (mongoose.models.TutorSession as Model<ITutorSession>) ||
  mongoose.model<ITutorSession>("TutorSession", TutorSessionSchema);
