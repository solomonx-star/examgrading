import type { NavItem } from "@/lib/nav";

type IconName = NavItem["icon"];

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 11.5 12 4l9 7.5M5 10.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9.5"
    />
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 20c.5-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M16 11a3 3 0 1 0 0-6M21.5 19c-.3-2.4-2-4-4-4.5"
      />
    </>
  ),
  book: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Zm2 14h12v2H6a2 2 0 0 1 0-4"
    />
  ),
  calendar: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 8h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3-2v4m8-4v4"
    />
  ),
  scale: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3v18M5 7h14M5 7l-2 6a3 3 0 0 0 6 0L7 7m12 0-2 6a3 3 0 0 0 6 0l-2-6M7 21h10"
    />
  ),
  clipboard: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 4h6a1 1 0 0 1 1 1v2H8V5a1 1 0 0 1 1-1Zm-3 3h12v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7Zm3 5h6m-6 4h6"
    />
  ),
  chart: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 19h16M6 17V10m4 7V6m4 11v-8m4 8V13"
    />
  ),
};

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
