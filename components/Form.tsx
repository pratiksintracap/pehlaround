"use client";
// The client half of the form pattern (lib/form.ts). Mounted once in the desk and console layouts.
// - Shows the result of the last action (?msg=, ?tone=err) as a toast, red when refused, and highlights the form it
//   came from (#hash). Success fades after a few seconds; a refusal stays until dismissed.
// - Takes msg/tone out of the address bar so a refresh or a shared link does not repeat it.
// - While a form is being sent, its submit button is disabled and marked busy, so nothing is sent twice.
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function FormResult() {
  const sp = useSearchParams();
  const path = usePathname();
  const msg = sp.get("msg");
  const tone = sp.get("tone") === "err" ? "err" : "ok";
  const [shown, setShown] = useState<{ msg: string; tone: string; key: number } | null>(null);

  useEffect(() => {
    // Any navigation means the last send finished: release busy buttons.
    document.querySelectorAll<HTMLButtonElement>("button[data-busy]").forEach((b) => { b.disabled = false; b.removeAttribute("data-busy"); });
    if (!msg) return;
    setShown({ msg, tone, key: Date.now() });
    const rest = new URLSearchParams(sp.toString());
    rest.delete("msg"); rest.delete("tone");
    // Plain replaceState, after Next has committed its own URL for this navigation; Next keeps its router in step.
    const t = setTimeout(() => window.history.replaceState(null, "", path + (rest.size ? `?${rest}` : "") + window.location.hash), 120);
    const id = window.location.hash.slice(1);
    const at = id ? document.getElementById(decodeURIComponent(id)) : null;
    if (at) {
      at.classList.remove("fr-hit"); void at.offsetWidth; at.classList.add("fr-hit");
      at.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    return () => clearTimeout(t);
  }, [msg, tone, path, sp]);

  useEffect(() => {
    if (!shown || shown.tone === "err") return;
    const t = setTimeout(() => setShown(null), 6000);
    return () => clearTimeout(t);
  }, [shown]);

  useEffect(() => {
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      // Search and filter forms (method="get") are not sends. React server-action forms carry no method attribute.
      if (f.getAttribute("method")?.toLowerCase() === "get" || f.hasAttribute("data-no-busy")) return;
      const b = (e.submitter as HTMLButtonElement | null) ?? f.querySelector<HTMLButtonElement>("button[type=submit],button:not([type])");
      if (!b) return;
      // After the browser has read the form (a disabled submitter is not sent).
      setTimeout(() => {
        // A form some script stopped (client-side checks) is not being sent. React stops server-action forms too, and sends
        // them itself: those carry a $ACTION_ID field (or a javascript: action once hydrated).
        const serverAction = !!f.querySelector('input[name^="$ACTION_ID"]') || /^javascript:/.test(f.getAttribute("action") ?? "");
        if (e.defaultPrevented && !serverAction) return;
        b.disabled = true; b.setAttribute("data-busy", "");
      }, 0);
      setTimeout(() => { if (b.isConnected) { b.disabled = false; b.removeAttribute("data-busy"); } }, 20000);
    };
    // Capture phase: React handles server-action forms itself and prevents the default.
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  if (!shown) return null;
  return (
    <div key={shown.key} className={`fr-toast ${shown.tone}`} role={shown.tone === "err" ? "alert" : "status"}>
      <span>{shown.msg}</span>
      <button type="button" aria-label="Dismiss" onClick={() => setShown(null)}>×</button>
    </div>
  );
}

