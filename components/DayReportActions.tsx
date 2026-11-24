"use client";
// The day report's hand-over: an optional note, then Download PDF or Copy for WhatsApp. Both go through
// /api/admin/day-report, which logs that the report was taken (the cut-off check reads that log).
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DayReportActions({ kind, who, day, own }: { kind: "start" | "end"; who: number; day: string; own: boolean }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "pdf" | "text">("");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const go = async (format: "pdf" | "text") => {
    setBusy(format); setMsg("");
    try {
      const fd = new FormData();
      fd.set("kind", kind); fd.set("who", String(who)); fd.set("day", day); fd.set("note", note); fd.set("format", format);
      const res = await fetch("/api/admin/day-report", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not make the report.");
      if (format === "pdf") {
        const blob = await res.blob();
        const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "")?.[1] || "day-report.pdf";
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        setMsg("Downloaded. Send the PDF to Pratik on WhatsApp.");
      } else {
        const { text } = await res.json();
        await navigator.clipboard.writeText(text);
        setMsg("Copied. Paste it into WhatsApp and send.");
      }
      router.refresh();
    } catch (e) { setMsg((e as Error).message); }
    setBusy("");
  };
  return (
    <div className="adm-card" style={{ marginTop: 14 }}>
      <label className="fine" htmlFor="dr-note" style={{ display: "block", marginBottom: 6 }}>
        {kind === "end" ? "Anything the portal doesn't show: calls, meetings, blockers (optional)" : "Today's plan or anything to flag (optional)"}
      </label>
      <textarea id="dr-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} style={{ width: "100%" }}
        placeholder={kind === "end" ? "e.g. Met Tirupati promoter on fees; Senco still waiting on consent" : "e.g. Calls with Parva and Flexiloans; chase Kidology numbers"} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
        <button type="button" className="btn primary sm" disabled={!!busy} onClick={() => go("pdf")}>{busy === "pdf" ? "Making the PDF…" : "Download PDF"}</button>
        <button type="button" className="btn sm" disabled={!!busy} onClick={() => go("text")}>{busy === "text" ? "Copying…" : "Copy for WhatsApp"}</button>
        {msg && <span className="fine" role="status">{msg}</span>}
      </div>
      {!own && <p className="fine" style={{ marginTop: 8 }}>This is someone else's report. Taking it here does not count as them sending it.</p>}
    </div>
  );
}
