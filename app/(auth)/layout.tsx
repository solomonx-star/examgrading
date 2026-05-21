import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-whiten">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <Image
              src="/IAMCOLOGO.png"
              alt="IAM CO College"
              width={96}
              height={96}
              priority
              className="mb-3 h-20 w-20 sm:h-24 sm:w-24"
            />
            <h1 className="text-2xl font-bold text-foreground">
              I AM CO
            </h1>
            <p className="mt-1 text-sm text-body">
              Exam Grade &amp; Attendance Management
            </p>
          </div>
          {children}
          <p className="mt-6 text-center text-xs text-body">
            © {new Date().getFullYear()} IAM CO College — Sierra Leone
          </p>
        </div>
      </main>
    </div>
  );
}
