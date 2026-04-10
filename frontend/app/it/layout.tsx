import { DashboardShell } from "@/components/admin/DashboardShell";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ITLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.metadata?.role || "customer";

  const navItems = [
    { label: "Overview", href: "/it" },
    { label: "Audit Logs", href: "/it/audit" },
    { label: "Payments", href: "/it/payments" },
    { label: "Security", href: "/it/security" },
  ];

  return (
    <DashboardShell 
      title="IT Command Center"
      subtitle="System Integrity"
      navItems={navItems}
      themeColor="blue"
      userRole={role}
    >
      {children}
    </DashboardShell>
  );
}
