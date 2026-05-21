"use client";

import Image from "next/image";

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-whiten px-6 py-10 text-center">
      <Image
        src="/IAMCOLOGO.png"
        alt="IAM CO"
        width={72}
        height={72}
        className="mb-5 h-16 w-16"
      />
      <h1 className="text-xl font-semibold text-foreground">
        You&rsquo;re offline
      </h1>
      <p className="mt-2 max-w-md text-sm text-body">
        We can&rsquo;t reach the server right now. Check your connection and
        try again — pages you&rsquo;ve already opened may still work.
      </p>
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.location.reload();
        }}
        className="mt-6 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
      >
        Try again
      </button>
    </main>
  );
}
