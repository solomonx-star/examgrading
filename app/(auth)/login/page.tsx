import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in — IAM CO Exam Management",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = sp.callbackUrl ?? "/";

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Sign in to your account
        </h2>
        <p className="mt-1 text-sm text-body">
          Use the credentials issued by your administrator.
        </p>
      </div>
      <LoginForm callbackUrl={callbackUrl} />
    </div>
  );
}
