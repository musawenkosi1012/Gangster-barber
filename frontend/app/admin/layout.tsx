import React from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

import { DashboardShell } from "@/components/admin/DashboardShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.metadata?.role || "customer";

  const navItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "Ledger", href: "/admin/ledger" },
    { label: "Schedule", href: "/admin/schedule" },
    { label: "Services", href: "/admin/services" },
    { label: "Customers", href: "/admin/customers" },
  ];

  return (
    <DashboardShell 
      title="Barber Control Tower"
      subtitle="Shop Floor Metrics"
      navItems={navItems}
      themeColor="red"
      userRole={role}
    >
      {children}
    </DashboardShell>
  );
}
