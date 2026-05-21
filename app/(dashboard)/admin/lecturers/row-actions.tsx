"use client";

import { UserRowActions } from "@/components/dashboard/UserRowActions";
import {
  resetLecturerPasswordAction,
  toggleLecturerActiveAction,
} from "./actions";

export function LecturerRowActions({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  return (
    <UserRowActions
      editHref={`/admin/lecturers/${id}`}
      isActive={isActive}
      onToggle={() => toggleLecturerActiveAction(id)}
      onResetPassword={() => resetLecturerPasswordAction(id)}
    />
  );
}
