import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = {
  title: "Change password — IAM CO Exam Management",
};

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const forced = session.user.mustChangePassword;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          {forced ? "Set a new password" : "Change your password"}
        </h2>
        <p className="mt-1 text-sm text-body">
          {forced
            ? "You must set a new password before continuing."
            : "Update the password for your account."}
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
