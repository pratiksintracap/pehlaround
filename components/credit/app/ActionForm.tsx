"use client";

import { startTransition, useActionState } from "react";

type ActionState = { error?: string; ok?: string; at?: number } | null;

/** Form bound to a server action, showing its success or error message inline. */
export function ActionForm({
  action,
  children,
  className = "stack",
  confirm,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      className={className}
      aria-busy={pending}
      // Submitting manually (rather than via the action prop) keeps typed values in place when the server
      // returns a validation error, instead of React resetting the form.
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        // Include the clicked button's name/value (forms with several submit buttons).
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const fd = new FormData(e.currentTarget, submitter && submitter.name ? submitter : undefined);
        startTransition(() => formAction(fd));
      }}
    >
      {children}
      {state?.error && <div className="msg error" role="alert">{state.error}</div>}
      {state?.ok && <div className="msg ok" role="status">{state.ok}</div>}
    </form>
  );
}

export function Submit({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="submit" className={className}>
      {children}
    </button>
  );
}
