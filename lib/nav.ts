import type { UserRole } from "@/models/User";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "users" | "book" | "calendar" | "scale" | "clipboard" | "chart" | "pencil";
};

export const ROLE_NAV: Record<UserRole, NavItem[]> = {
  superadmin: [
    { href: "/superadmin", label: "Overview", icon: "home" },
    { href: "/superadmin/admins", label: "Admins", icon: "users" },
    { href: "/superadmin/ai-credits", label: "AI Credits", icon: "chart" },
    { href: "/superadmin/grading-rules", label: "Grading rules", icon: "scale" },
    { href: "/superadmin/academic-periods", label: "Academic periods", icon: "calendar" },
    { href: "/superadmin/access-payments", label: "Access payments", icon: "clipboard" },
    { href: "/superadmin/audit", label: "Audit log", icon: "clipboard" },
  ],
  admin: [
    { href: "/admin", label: "Overview", icon: "home" },
    { href: "/admin/students", label: "Students", icon: "users" },
    { href: "/admin/lecturers", label: "Lecturers", icon: "users" },
    { href: "/admin/programmes", label: "Programmes", icon: "book" },
    { href: "/admin/modules", label: "Modules", icon: "book" },
    { href: "/admin/grades", label: "Grade reviews", icon: "scale" },
    { href: "/admin/reports", label: "Reports", icon: "chart" },
    { href: "/admin/audit", label: "Audit log", icon: "clipboard" },
  ],
  lecturer: [
    { href: "/lecturer", label: "Overview", icon: "home" },
    { href: "/lecturer/modules", label: "My modules", icon: "book" },
    { href: "/lecturer/reports", label: "Reports", icon: "chart" },
  ],
  student: [
    { href: "/student", label: "Overview", icon: "home" },
    { href: "/student/modules", label: "My modules", icon: "book" },
    { href: "/student/tests", label: "Tests", icon: "pencil" },
    { href: "/student/attendance", label: "Attendance", icon: "clipboard" },
    { href: "/student/grades", label: "Grades", icon: "scale" },
    { href: "/student/transcript", label: "Transcript", icon: "chart" },
    { href: "/student/calculator", label: "Calculator", icon: "scale" },
    { href: "/student/timeline", label: "Timeline", icon: "calendar" },
    { href: "/student/credits", label: "AI Credits", icon: "chart" },
    { href: "/student/ai/report", label: "Performance Coach", icon: "chart" },
    { href: "/student/ai/study-plan", label: "Study Plan", icon: "calendar" },
    { href: "/student/access", label: "Pay access", icon: "scale" },
  ],
};

export const ROLE_LABEL: Record<UserRole, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  lecturer: "Lecturer",
  student: "Student",
};
