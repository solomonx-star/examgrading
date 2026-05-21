import mongoose, { Schema, Model, Types } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "superadmin" | "admin" | "lecturer" | "student";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  studentId?: string;
  staffId?: string;
  programmeId?: Types.ObjectId | null;
  yearLevel?: number | null;
  department?: string;
  profileImage?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserModel = Model<IUser, Record<string, never>, IUserMethods>;

const UserSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, minlength: 8 },
    role: {
      type: String,
      enum: ["superadmin", "admin", "lecturer", "student"],
      required: true,
      index: true,
    },
    studentId: { type: String, unique: true, sparse: true, trim: true },
    staffId: { type: String, unique: true, sparse: true, trim: true },
    programmeId: {
      type: Schema.Types.ObjectId,
      ref: "Programme",
      default: null,
      index: true,
    },
    yearLevel: { type: Number, min: 1, max: 4, default: null },
    department: { type: String, trim: true },
    profileImage: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
  },
  { timestamps: true },
);

UserSchema.pre("validate", function () {
  if (this.role === "student") {
    if (!this.programmeId) {
      this.invalidate("programmeId", "Students must have a programme.");
    }
    if (
      this.yearLevel === null ||
      this.yearLevel === undefined ||
      this.yearLevel < 1 ||
      this.yearLevel > 4
    ) {
      this.invalidate("yearLevel", "Students must have a year level (1–4).");
    }
  }
});

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.pre("save", async function () {
  if (this.role !== "student" || this.studentId) return;
  const year = new Date().getFullYear();
  const UserCol = mongoose.models.User as UserModel | undefined;
  const count = UserCol
    ? await UserCol.countDocuments({ role: "student" })
    : 0;
  this.studentId = `IAMCO-${year}-${String(count + 1).padStart(4, "0")}`;
});

UserSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

UserSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    delete r.password;
    return r;
  },
});

export const User: UserModel =
  (mongoose.models.User as UserModel) ||
  mongoose.model<IUser, UserModel>("User", UserSchema);
