import { redirect } from "next/navigation";
import { getClaims } from "@/lib/auth";

/**
 * The authoritative page-level auth boundary. The proxy redirects first as an
 * optimistic fast path, but the Next docs are explicit that proxy is not a
 * substitute for checking at the point of render.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await getClaims())) redirect("/login");

  return <>{children}</>;
}
