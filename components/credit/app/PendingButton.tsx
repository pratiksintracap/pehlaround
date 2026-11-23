"use client";

import { useFormStatus } from "react-dom";

/** Submit button that shows it's working and can't be pressed twice while the form is being sent. */
export function PendingButton({ children, pendingText, className }: { children: React.ReactNode; pendingText: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`${className ?? ""} ${pending ? "is-pending" : ""}`} disabled={pending} aria-busy={pending}>
      {pending && <span className="spinner" aria-hidden="true" />}
      {pending ? pendingText : children}
    </button>
  );
}
