import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already logged in? Skip the form.
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="m-auto w-full max-w-md">
      <LoginForm />
    </div>
  );
}
