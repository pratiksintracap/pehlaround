import type { Metadata } from "next";
import { requireDesk } from "@/lib/auth";
import { Suspense } from "react";
import { FormResult } from "@/components/Form";

// The desk as it appears inside the phone app: Today, Pipeline, Investors and Tasks.
// Desk only (super admin and analysts); investors are sent to their dashboard. The full console stays at /admin.
export const metadata: Metadata = { title: "Desk", robots: { index: false } };

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  await requireDesk();
  return <main className="dk"><Suspense fallback={null}><FormResult /></Suspense>{children}</main>;
}
