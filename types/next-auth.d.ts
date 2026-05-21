import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/models/User";

declare module "next-auth" {
  interface User {
    id?: string;
    role: UserRole;
    mustChangePassword: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    mustChangePassword: boolean;
  }
}
