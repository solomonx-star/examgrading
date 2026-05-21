"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarNav } from "./Sidebar";
import { Header } from "./Header";
import { Breadcrumbs } from "./Breadcrumbs";
import { OfflineIndicator } from "./OfflineIndicator";
import type { NavItem } from "@/lib/nav";

export function DashboardShell({
  navItems,
  roleLabel,
  name,
  email,
  notificationBell,
  children,
}: {
  navItems: NavItem[];
  roleLabel: string;
  name: string;
  email: string;
  notificationBell?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape, and lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="flex min-h-screen bg-whiten">
      <Sidebar items={navItems} roleLabel={roleLabel} />

      {/* Mobile drawer */}
      <div
        className={
          "fixed inset-0 z-40 md:hidden " +
          (open ? "" : "pointer-events-none")
        }
        aria-hidden={!open}
      >
        <div
          className={
            "absolute inset-0 bg-black/40 transition-opacity duration-200 " +
            (open ? "opacity-100" : "opacity-0")
          }
          onClick={() => setOpen(false)}
        />
        <aside
          className={
            "absolute left-0 top-0 flex h-full w-64 max-w-[85%] flex-col bg-iamco-blue shadow-xl transition-transform duration-200 " +
            (open ? "translate-x-0" : "-translate-x-full")
          }
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <SidebarNav
            items={navItems}
            roleLabel={roleLabel}
            onLinkClick={() => setOpen(false)}
          />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineIndicator />
        <Header
          name={name}
          email={email}
          roleLabel={roleLabel}
          onMenuClick={() => setOpen(true)}
          notificationBell={notificationBell}
        />
        <main className="flex-1 px-4 py-4 sm:px-5 sm:py-6 md:px-8 md:py-8">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
