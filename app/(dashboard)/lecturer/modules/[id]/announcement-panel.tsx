"use client";

import { useActionState, useState } from "react";
import { createAnnouncementAction, deleteAnnouncementAction } from "@/lib/actions/announcements";

type Announcement = {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
};

type Props = {
  courseId: string;
  announcements: Announcement[];
};

export function AnnouncementPanel({ courseId, announcements: initial }: Props) {
  const [announcements, setAnnouncements] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await createAnnouncementAction(_prev, formData);
      if (result.ok) setShowForm(false);
      return result;
    },
    undefined,
  );

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteAnnouncementAction(id);
    if (result.ok) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    }
    setDeletingId(null);
  }

  return (
    <section className="mb-6 rounded-2xl border border-stroke bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-stroke px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">Announcements</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {showForm ? "Cancel" : "+ New"}
        </button>
      </div>

      {showForm && (
        <form action={formAction} className="border-b border-stroke p-5 space-y-3">
          <input type="hidden" name="courseId" value={courseId} />
          <div>
            <label className="block text-xs font-medium text-body">Title</label>
            <input
              name="title"
              required
              maxLength={200}
              className="mt-1 w-full rounded-xl border border-stroke px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Exam date confirmed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-body">Message</label>
            <textarea
              name="body"
              required
              maxLength={4000}
              rows={4}
              className="mt-1 w-full resize-none rounded-xl border border-stroke px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Write your announcement here…"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPinned" id="isPinned" value="true" className="rounded" />
            <label htmlFor="isPinned" className="text-body">Pin to top</label>
          </div>
          {state && !state.ok && (
            <p className="text-xs text-meta-1">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {pending ? "Posting…" : "Post announcement"}
          </button>
        </form>
      )}

      {announcements.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-body">
          No announcements yet. Post one to notify your students.
        </p>
      ) : (
        <ul className="divide-y divide-stroke">
          {announcements.map((ann) => (
            <li key={ann.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {ann.isPinned && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Pinned
                      </span>
                    )}
                    <p className="text-sm font-semibold text-foreground">{ann.title}</p>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-body">{ann.body}</p>
                  <p className="mt-1 text-xs text-body">
                    {new Date(ann.createdAt).toLocaleDateString("en-GB", {
                      weekday: "short", day: "2-digit", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(ann.id)}
                  disabled={deletingId === ann.id}
                  className="shrink-0 text-xs text-meta-1 hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
