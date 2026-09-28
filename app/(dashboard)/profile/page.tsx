import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { ProfileForm } from "@/components/dashboard/ProfileForm";

export const metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();
  const user = await User.findById(session.user.id)
    .select("name email phone role studentId staffId")
    .lean();

  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">My profile</h1>
        <p className="mt-1 text-sm text-body">
          Update your name and phone number.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stroke">
        <dl className="space-y-3 text-sm">
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 font-medium text-foreground">Email</dt>
            <dd className="text-body">{user.email}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 font-medium text-foreground">Role</dt>
            <dd className="text-body capitalize">{user.role}</dd>
          </div>
          {user.studentId ? (
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 font-medium text-foreground">Student ID</dt>
              <dd className="text-body">{user.studentId}</dd>
            </div>
          ) : null}
          {user.staffId ? (
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 font-medium text-foreground">Staff ID</dt>
              <dd className="text-body">{user.staffId}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <ProfileForm
        defaultName={user.name}
        defaultPhone={user.phone ?? ""}
      />
    </div>
  );
}
