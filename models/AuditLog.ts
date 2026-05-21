import mongoose, { Schema, Model, Types } from "mongoose";

export type AuditActorRole =
  | "superadmin"
  | "admin"
  | "lecturer"
  | "student"
  | "system";

export interface IAuditLog {
  _id: Types.ObjectId;
  at: Date;
  actorId?: Types.ObjectId;
  actorName?: string;
  actorRole?: AuditActorRole;
  actorDepartment?: string;
  action: string;
  entityType?: string;
  entityId?: Types.ObjectId;
  summary: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    at: { type: Date, required: true, default: () => new Date() },
    actorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorName: { type: String, trim: true },
    actorRole: {
      type: String,
      enum: ["superadmin", "admin", "lecturer", "student", "system"],
    },
    actorDepartment: { type: String, trim: true, index: true },
    action: { type: String, required: true, trim: true, index: true },
    entityType: { type: String, trim: true },
    entityId: { type: Schema.Types.ObjectId },
    summary: { type: String, required: true, trim: true },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { timestamps: true },
);

// Newest first, paginated
AuditLogSchema.index({ at: -1 });
// Department-scoped lookup for admins
AuditLogSchema.index({ actorDepartment: 1, at: -1 });
// Drill down to events touching a specific entity
AuditLogSchema.index({ entityType: 1, entityId: 1, at: -1 });

export const AuditLog: Model<IAuditLog> =
  (mongoose.models.AuditLog as Model<IAuditLog>) ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
