export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-stroke bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-body">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-body">{hint}</p> : null}
    </div>
  );
}
