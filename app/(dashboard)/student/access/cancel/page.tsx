import Link from "next/link";

export default function AccessCancelPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-stroke bg-white p-6 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">
          Payment cancelled
        </h2>
        <p className="mt-2 text-sm text-body">
          You cancelled the checkout. You can try again whenever you&rsquo;re
          ready.
        </p>
        <Link
          href="/student/access"
          className="mt-5 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
        >
          Back to payment
        </Link>
      </div>
    </div>
  );
}
