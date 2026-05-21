"use client";

import { UserRowActions } from "@/components/dashboard/UserRowActions";
import {
  resetStudentPasswordAction,
  toggleStudentActiveAction,
} from "./actions";

export function StudentRowActions({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  return (
    <UserRowActions
      editHref={`/admin/students/${id}`}
      isActive={isActive}
      onToggle={() => toggleStudentActiveAction(id)}
      onResetPassword={() => resetStudentPasswordAction(id)}
    />
  );
}
