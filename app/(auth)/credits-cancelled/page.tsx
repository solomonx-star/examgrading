import Link from "next/link";

export default function CreditsCancelledPage() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-stroke bg-white p-8 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-foreground">Payment cancelled</h2>
      <p className="mt-2 text-sm text-body">
        You cancelled the checkout. Your credits were not changed — you can top
        up whenever you&rsquo;re ready.
      </p>
      <Link
        href="/login?callbackUrl=/student/credits"
        className="mt-6 inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
      >
        Back to credits
      </Link>
    </div>
  );
}
