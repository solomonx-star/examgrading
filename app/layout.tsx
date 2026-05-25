import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import PostHogPageView from "@/components/providers/PostHogPageView";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import "./globals.css";

const satoshi = localFont({
  src: [
    { path: "../fonts/Satoshi-Variable.woff2", style: "normal" },
    { path: "../fonts/Satoshi-VariableItalic.woff2", style: "italic" },
  ],
  variable: "--font-satoshi",
  display: "swap",
  weight: "300 900",
});

export const metadata: Metadata = {
  title: "Exam Management",
  description: "Exam management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${satoshi.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <QueryProvider>
            <Analytics />
            {children}
          </QueryProvider>
        </PostHogProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: { toast: "print:hidden" },
          }}
        />
      </body>
    </html>
  );
}
