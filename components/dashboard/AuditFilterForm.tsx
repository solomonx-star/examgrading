import Link from "next/link";

export function AuditFilterForm({
  baseHref,
  actions,
  defaults,
}: {
  baseHref: string;
  actions: string[];
  defaults: { actor?: string; action?: string; from?: string; to?: string };
}) {
  const isFiltered =
    !!defaults.actor || !!defaults.action || !!defaults.from || !!defaults.to;

  return (
    <form className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-stroke bg-white p-4 shadow-sm sm:grid-cols-2 sm:items-end lg:grid-cols-[2fr_2fr_1fr_1fr_auto]">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-foreground">
          Actor name
        </label>
        <input
          name="actor"
          defaultValue={defaults.actor ?? ""}
          placeholder="e.g. Aminata"
          className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-foreground">
          Action
        </label>
        <select
          name="action"
          defaultValue={defaults.action ?? ""}
          className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-foreground">From</label>
        <input
          type="date"
          name="from"
          defaultValue={defaults.from ?? ""}
          className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-foreground">To</label>
        <input
          type="date"
          name="to"
          defaultValue={defaults.to ?? ""}
          className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
        >
          Filter
        </button>
        {isFiltered ? (
          <Link
            href={baseHref}
            className="text-sm font-medium text-body hover:text-foreground"
          >
            Reset
          </Link>
        ) : null}
      </div>
    </form>
  );
}
