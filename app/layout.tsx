import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";
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
        <QueryProvider>{children}</QueryProvider>
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
