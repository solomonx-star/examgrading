"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import type { NavItem } from "@/lib/nav";

export function SidebarNav({
  items,
  roleLabel,
  onLinkClick,
}: {
  items: NavItem[];
  roleLabel: string;
  onLinkClick?: () => void;
}) {
  const pathname = usePathname();
  return (
    <>
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-2.5">
        <Image
          src="/IAMCOLOGO.png"
          alt="IAM CO"
          width={40}
          height={40}
          className="h-10 w-10 shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">I AM CO</p>
          <p className="truncate text-xs text-white/70">{roleLabel}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              aria-current={active ? "page" : undefined}
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition motion-reduce:transition-none " +
                (active
                  ? "bg-white/15 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white")
              }
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function Sidebar({
  items,
  roleLabel,
}: {
  items: NavItem[];
  roleLabel: string;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto bg-iamco-blue lg:flex lg:flex-col">
      <SidebarNav items={items} roleLabel={roleLabel} />
    </aside>
  );
}
