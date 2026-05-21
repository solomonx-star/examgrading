"use client";

import Image from "next/image";
import { useFormStatus } from "react-dom";
import { signOutAction } from "@/lib/actions/auth";

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-stroke px-3 text-xs font-semibold text-body transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:border-stroke disabled:hover:text-body"
    >
      {pending && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-3.5 w-3.5 animate-spin"
          aria-hidden
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="3"
          />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function Header({
  name,
  email,
  roleLabel,
  onMenuClick,
  notificationBell,
}: {
  name: string;
  email: string;
  roleLabel: string;
  onMenuClick?: () => void;
  notificationBell?: React.ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-stroke bg-white px-4 py-3 sm:px-5">
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stroke text-body hover:border-primary hover:text-primary lg:hidden"
        aria-label="Open navigation"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <div className="flex min-w-0 items-center gap-2 lg:hidden">
        <Image
          src="/IAMCOLOGO.png"
          alt="IAM CO"
          width={32}
          height={32}
          className="h-8 w-8 shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            IAM CO
          </p>
          <p className="truncate text-xs text-body">{roleLabel}</p>
        </div>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-3">
        {notificationBell}
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="hidden truncate text-xs text-body sm:block">{email}</p>
        </div>
        <form action={signOutAction}>
          <SignOutButton />
        </form>
      </div>
    </header>
  );
}
