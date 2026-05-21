"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  publishStudentGradesAction,
  unpublishStudentGradesAction,
} from "../../../actions";

export function StudentReviewActions({
  studentId,
  programmeId,
  yearLevel,
  academicYear,
  semester,
  submittedCount,
  publishedCount,
  draftCount,
}: {
  studentId: string;
  programmeId: string;
  yearLevel: number;
  academicYear: string;
  semester: "First" | "Second" | "Summer";
  submittedCount: number;
  publishedCount: number;
  draftCount: number;
}) {
  const [publishPending, startPublish] = useTransition();
  const [unpublishPending, startUnpublish] = useTransition();
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);

  function publish() {
    startPublish(async () => {
      try {
        const res = await publishStudentGradesAction({
          studentId,
          programmeId,
          yearLevel,
          academicYear,
          semester,
        });
        if (res.ok) {
          toast.success(
            `Published ${res.count ?? 0} grade${res.count === 1 ? "" : "s"}.`,
          );
          setPublishOpen(false);
        } else {
          toast.error(res.error ?? "Could not publish.");
        }
      } catch {
        toast.error("Could not publish grades.");
      }
    });
  }

  function unpublish() {
    startUnpublish(async () => {
      try {
        const res = await unpublishStudentGradesAction({
          studentId,
          programmeId,
          yearLevel,
          academicYear,
          semester,
        });
        if (res.ok) {
          toast.success(
            `Unpublished ${res.count ?? 0} grade${res.count === 1 ? "" : "s"}.`,
          );
          setUnpublishOpen(false);
        } else {
          toast.error(res.error ?? "Could not unpublish.");
        }
      } catch {
        toast.error("Could not unpublish grades.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setPublishOpen(true)}
        disabled={publishPending || submittedCount === 0}
        className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {publishPending
          ? "Publishing…"
          : `Publish ${submittedCount} submitted`}
      </button>
      <button
        type="button"
        onClick={() => setUnpublishOpen(true)}
        disabled={unpublishPending || publishedCount === 0}
        className="inline-flex items-center rounded-lg border border-meta-1/40 px-4 py-2 text-sm font-semibold text-meta-1 hover:bg-meta-1/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {unpublishPending
          ? "Unpublishing…"
          : `Unpublish ${publishedCount} published`}
      </button>

      <ConfirmModal
        open={publishOpen}
        title={`Publish ${submittedCount} grade${submittedCount === 1 ? "" : "s"}?`}
        description={
          <>
            <p>
              The student will see {submittedCount === 1 ? "it" : "them"}{" "}
              immediately.
            </p>
            {draftCount > 0 && (
              <p className="mt-2 text-meta-1">
                {draftCount} module{draftCount === 1 ? "" : "s"} still in draft
                will NOT be published yet.
              </p>
            )}
          </>
        }
        confirmLabel="Publish"
        pending={publishPending}
        onConfirm={publish}
        onCancel={() => setPublishOpen(false)}
      />

      <ConfirmModal
        open={unpublishOpen}
        title={`Unpublish ${publishedCount} grade${publishedCount === 1 ? "" : "s"}?`}
        description={
          <>The student will no longer see these grades.</>
        }
        confirmLabel="Unpublish"
        tone="danger"
        pending={unpublishPending}
        onConfirm={unpublish}
        onCancel={() => setUnpublishOpen(false)}
      />
    </div>
  );
}
