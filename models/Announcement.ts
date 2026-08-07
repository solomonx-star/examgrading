import mongoose, { Schema, Model, Types } from "mongoose";

export interface IAnnouncement {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  authorId: Types.ObjectId;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

AnnouncementSchema.index({ courseId: 1, createdAt: -1 });

export const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement ??
  mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);
