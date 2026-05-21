import { redirect } from "next/navigation";

// Proxy redirects authenticated users from "/" to their role home.
// Anyone hitting this page is unauthenticated — send them to /login.
export default function RootPage() {
  redirect("/login");
}
