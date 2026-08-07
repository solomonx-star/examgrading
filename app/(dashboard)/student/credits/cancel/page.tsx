import Link from "next/link";

export default function CreditsCancelPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-stroke bg-white p-6 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">Payment cancelled</h2>
        <p className="mt-2 text-sm text-body">
          You cancelled the checkout. Your credits were not changed — you can top up whenever
          you&rsquo;re ready.
        </p>
        <Link
          href="/student/credits"
          className="mt-5 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
        >
          Back to credits
        </Link>
      </div>
    </div>
  );
}
