import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}

class InactiveAccount extends CredentialsSignin {
  code = "inactive_account";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || password.length < 1) {
          throw new InvalidCredentials();
        }

        await connectDB();
        const user = await User.findOne({ email });

        if (!user) throw new InvalidCredentials();
        if (!user.isActive) throw new InactiveAccount();

        const ok = await user.comparePassword(password);
        if (!ok) throw new InvalidCredentials();

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user.id ?? token.sub) as string;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.mustChangePassword = token.mustChangePassword;
      return session;
    },
  },
});
