import { z } from "zod";

const objectIdRe = /^[a-f\d]{24}$/i;
const objectIdSchema = z.string().regex(objectIdRe, "Invalid id");

export const adminCreateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email"),
  staffId: z.string().trim().optional().or(z.literal("")),
});

export const adminUpdateSchema = adminCreateSchema.extend({
  isActive: z.coerce.boolean(),
  mustChangePassword: z.coerce.boolean(),
});

export const studentCreateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email"),
  programmeId: objectIdSchema,
  yearLevel: z.coerce.number().int().min(1).max(4),
});

export const studentUpdateSchema = studentCreateSchema.extend({
  isActive: z.coerce.boolean(),
  mustChangePassword: z.coerce.boolean(),
});

export const lecturerCreateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email"),
  staffId: z.string().trim().optional().or(z.literal("")),
});

export const lecturerUpdateSchema = lecturerCreateSchema.extend({
  isActive: z.coerce.boolean(),
  mustChangePassword: z.coerce.boolean(),
});

export const programmeCreateSchema = z.object({
  name: z.string().trim().min(2, "Programme name is required"),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Programme code is required"),
});

export const programmeUpdateSchema = programmeCreateSchema.extend({
  isActive: z.coerce.boolean(),
});

export const courseCreateSchema = z.object({
  name: z.string().trim().min(2),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Module code is required"),
  programmeId: objectIdSchema,
  yearLevel: z.coerce.number().int().min(1).max(4),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{4}$/, "Year must look like 2025/2026"),
  semester: z.enum(["First", "Second", "Summer"]),
  lecturerId: objectIdSchema.optional().or(z.literal("")),
  gradingRuleId: objectIdSchema.optional().or(z.literal("")),
  enrolledStudents: z.array(objectIdSchema).default([]),
});

export const courseUpdateSchema = courseCreateSchema.extend({
  isActive: z.coerce.boolean(),
});

const semesterSchema = z.enum(["First", "Second", "Summer"]);

export const academicPeriodSchema = z.object({
  year: z
    .string()
    .trim()
    .regex(/^\d{4}\/\d{4}$/, "Year must look like 2025/2026"),
  semester: semesterSchema,
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  isCurrent: z.coerce.boolean().optional(),
  accessFee: z.coerce
    .number()
    .min(0, "Access fee can't be negative")
    .default(0),
});

const gradeBandSchema = z.object({
  min: z.coerce.number().min(0).max(100),
  max: z.coerce.number().min(0).max(100),
  grade: z.string().trim().min(1).max(2),
  gpa: z.coerce.number().min(0).max(4),
  remark: z.string().trim().min(1),
});

export const gradingRuleUpdateSchema = z
  .object({
    name: z.string().trim().min(2),
    caWeight: z.coerce.number().min(0).max(100),
    examWeight: z.coerce.number().min(0).max(100),
    attendanceThreshold: z.coerce.number().min(0).max(100),
    gradeScale: z.array(gradeBandSchema).min(1),
  })
  .refine((v) => v.caWeight + v.examWeight === 100, {
    message: "CA weight + exam weight must equal 100",
    path: ["caWeight"],
  });
