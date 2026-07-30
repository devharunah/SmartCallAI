import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { getClaims } from "@/lib/auth";

export default async function SignupPage() {
  if (await getClaims()) redirect("/admin");

  return <SignupForm />;
}
