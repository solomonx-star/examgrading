"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Circle,
  ShieldCheck,
  GraduationCap,
  BookOpen,
  UserCog,
} from "lucide-react";

type OnlineUser = {
  id: string;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "lecturer" | "student";
  lastActiveAt: string | null;
};

const ROLE_META: Record<
  OnlineUser["role"],
  { label: string; Icon: typeof ShieldCheck }
> = {
  superadmin: { label: "Super admin", Icon: ShieldCheck },
  admin: { label: "Admin", Icon: UserCog },
  lecturer: { label: "Lecturer", Icon: BookOpen },
  student: { label: "Student", Icon: GraduationCap },
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 15_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function OnlineUsersCard() {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/superadmin/online", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { users?: OnlineUser[] };
        if (cancelled) return;
        setUsers(data.users ?? []);
        setLoaded(true);
      } catch {
        // swallow — surface as "—" in UI
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-body" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wide text-body">
            Online now
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Circle
            className="h-2.5 w-2.5 fill-meta-3 text-meta-3"
            aria-hidden
          />
          {loaded ? users.length : "…"}
        </div>
      </div>

      <p className="mt-1 text-xs text-body">
        Active in the last 2 minutes.
      </p>

      <ul className="mt-3 max-h-72 divide-y divide-stroke overflow-y-auto">
        {!loaded ? (
          <li className="py-3 text-sm text-body">Loading…</li>
        ) : users.length === 0 ? (
          <li className="py-3 text-sm text-body">No one online right now.</li>
        ) : (
          users.map((u) => {
            const meta = ROLE_META[u.role];
            const RoleIcon = meta.Icon;
            return (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-iamco-blue/10 text-iamco-blue">
                    <RoleIcon className="h-4 w-4" aria-hidden />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-meta-3"
                      aria-label="online"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {u.name}
                    </p>
                    <p className="truncate text-xs text-body">
                      {meta.label} · {u.email}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-body">
                  {formatRelative(u.lastActiveAt)}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
