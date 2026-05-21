import Link from "next/link";

export type PageHeaderAction = { href: string; label: string };

export function PageHeader({
  title,
  description,
  action,
  secondaryAction,
}: {
  title: string;
  description?: string;
  action?: PageHeaderAction;
  secondaryAction?: PageHeaderAction;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-body">{description}</p>
        ) : null}
      </div>
      {action || secondaryAction ? (
        <div className="flex items-center gap-2">
          {secondaryAction ? (
            <Link
              href={secondaryAction.href}
              className="inline-flex items-center rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium text-body shadow-sm transition hover:border-primary hover:text-primary"
            >
              {secondaryAction.label}
            </Link>
          ) : null}
          {action ? (
            <Link
              href={action.href}
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
            >
              {action.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
