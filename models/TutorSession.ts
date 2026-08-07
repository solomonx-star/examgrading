import mongoose, { Schema, Model, Types } from "mongoose";

export interface ITutorMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface ITutorSession {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  messages: ITutorMessage[];
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
      index: true,
    },
    messages: { type: [TutorMessageSchema], default: [] },
  },
  { timestamps: true },
);

TutorSessionSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

export const TutorSession: Model<ITutorSession> =
  (mongoose.models.TutorSession as Model<ITutorSession>) ||
  mongoose.model<ITutorSession>("TutorSession", TutorSessionSchema);
