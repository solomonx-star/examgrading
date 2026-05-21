"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROLE_ROOTS = new Set(["admin", "superadmin", "lecturer", "student"]);

const SLUG_LABELS: Record<string, string> = {
  admin: "Admin",
  superadmin: "Super Admin",
  lecturer: "Lecturer",
  student: "Student",

  overview: "Overview",
  students: "Students",
  lecturers: "Lecturers",
  admins: "Admins",
  programmes: "Programmes",
  modules: "Modules",
  grades: "Grade reviews",
  reports: "Reports",
  audit: "Audit log",
  attendance: "Attendance",
  transcript: "Transcript",
  "academic-periods": "Academic periods",
  "grading-rules": "Grading rules",
  "access-payments": "Access payments",
  access: "System access",
  receipt: "Receipt",
  success: "Success",
  cancel: "Cancelled",
  print: "Print",

  new: "New",
  import: "Import",
};

const ID_LABEL_BY_PARENT: Record<string, string> = {
  students: "Student",
  lecturers: "Lecturer",
  admins: "Admin",
  programmes: "Programme",
  modules: "Module",
  grades: "Student",
  "grading-rules": "Rule",
};

function looksLikeId(segment: string): boolean {
  if (/^\d{4}-\d{4}$/.test(segment)) return false;
  if (/^[A-Za-z]+$/.test(segment) && segment.length <= 12) return false;
  return /^[a-f0-9]{12,}$/i.test(segment) || segment.length >= 16;
}

function labelFor(segment: string, parent: string | undefined): string {
  if (SLUG_LABELS[segment]) return SLUG_LABELS[segment];
  if (looksLikeId(segment)) {
    if (parent && ID_LABEL_BY_PARENT[parent]) return ID_LABEL_BY_PARENT[parent];
    return "Details";
  }
  return segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumbs() {
  const pathname = usePathname() ?? "/";
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;
  // Skip the role root segment; the sidebar already conveys role context.
  if (segments.length === 1 && ROLE_ROOTS.has(segments[0])) return null;

  const crumbs = segments.map((segment, i) => ({
    href: "/" + segments.slice(0, i + 1).join("/"),
    label: labelFor(segment, segments[i - 1]),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 text-sm text-body print:hidden"
    >
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1">
            {i > 0 && (
              <span aria-hidden className="text-body/60">
                /
              </span>
            )}
            {crumb.isLast ? (
              <span
                aria-current="page"
                className="font-medium text-foreground"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-primary hover:underline"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
