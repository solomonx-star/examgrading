"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";

type BellItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

type BellData = {
  unread: number;
  items: BellItem[];
};

const NOTIFICATIONS_QUERY_KEY = ["notifications", "recent"] as const;

async function fetchRecent(): Promise<BellData> {
  const res = await fetch("/api/notifications/recent", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error("Failed to load notifications");
  return res.json();
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function BellDropdown({ initialData }: { initialData: BellData }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchRecent,
    initialData,
    // Poll every minute so newly-arrived notifications surface without a
    // page refresh. Window-focus refetch is on by default from the provider.
    refetchInterval: 60_000,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationReadAction(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<BellData>(
        NOTIFICATIONS_QUERY_KEY,
      );
      if (previous) {
        const items = previous.items.map((n) =>
          n.id === id && !n.isRead ? { ...n, isRead: true } : n,
        );
        const unread = items.filter((n) => !n.isRead).length;
        queryClient.setQueryData<BellData>(NOTIFICATIONS_QUERY_KEY, {
          unread,
          items,
        });
      }
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous)
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsReadAction(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<BellData>(
        NOTIFICATIONS_QUERY_KEY,
      );
      if (previous) {
        queryClient.setQueryData<BellData>(NOTIFICATIONS_QUERY_KEY, {
          unread: 0,
          items: previous.items.map((n) => ({ ...n, isRead: true })),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous)
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unread > 0 ? `Notifications (${unread} unread)` : "Notifications"
        }
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stroke text-body transition hover:border-primary hover:text-primary"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-5 w-5"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-meta-1 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-stroke bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-stroke px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              Notifications
            </p>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending || unread === 0}
              className="text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-body disabled:no-underline"
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-96 divide-y divide-stroke overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-body">
                No notifications yet.
              </li>
            ) : (
              items.map((n) => {
                const body = (
                  <div className="flex items-start gap-2">
                    {!n.isRead && (
                      <span
                        aria-hidden
                        className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
                      />
                    )}
                    <div className={n.isRead ? "pl-4" : ""}>
                      <p
                        className={
                          "text-sm " +
                          (n.isRead
                            ? "text-body"
                            : "font-semibold text-foreground")
                        }
                      >
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-body">{n.body}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-body/70">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => {
                          if (!n.isRead) markOne.mutate(n.id);
                          setOpen(false);
                        }}
                        className="block px-4 py-3 hover:bg-whiter"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!n.isRead) markOne.mutate(n.id);
                        }}
                        className="block w-full px-4 py-3 text-left hover:bg-whiter"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
