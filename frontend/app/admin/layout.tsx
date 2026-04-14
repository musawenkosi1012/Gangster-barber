import React from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

import { DashboardShell } from "@/components/admin/DashboardShell";
import { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://gangsterbarber.com"),
  title: "Gangster Barber Admin",
  description: "Tactical Control Terminal for Gangster Barber CRM",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.metadata?.role || "customer";

  // Security Guard: Prevent unauthorized 'customer' or unauthenticated drift into the terminal zone.
  if (role === "customer") {
    redirect("/");
  }

  const navItems = [
    { label: "Schedule", href: "/admin" },
    { label: "Ledger", href: "/admin/ledger" },
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
