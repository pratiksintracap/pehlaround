"use client";
import { useEffect, useRef, useState } from "react";

// The pitch deck in a side panel: any element with data-deck="/api/docs/12?embed=1" and data-deck-title opens it
// here, at half the screen, with a button to take it full screen. Every open still goes through /api/docs, so
// it is logged against the person and office as before. On a phone the panel is always full screen.
export function DeckPanel() {
  const [doc, setDoc] = useState<{ src: string; title: string; href: string; room?: string } | null>(null);
  const [full, setFull] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-deck]");
      if (!el || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const src = el.dataset.deck!;
      setDoc({ src, title: el.dataset.deckTitle || "Pitch deck", href: src.replace(/[?&]embed=1/, ""), room: el.dataset.deckNext });
      setFull(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (doc && !d.open) d.showModal();
    if (!doc && d.open) d.close();
  }, [doc]);

  return (
    <dialog ref={ref} className={`deckpanel${full ? " full" : ""}`} aria-label={doc?.title || "Pitch deck"}
      onClose={() => setDoc(null)} onClick={(e) => { if (e.target === ref.current) setDoc(null); }}>
      {doc && <div className="dp-in">
        <div className="dp-head">
          <b>{doc.title}</b>
          <div className="dp-acts">
            {doc.room && <a className="btn sm primary" href={doc.room}>Next: sign the NDA</a>}
            <button type="button" className="btn sm ghost dp-size" onClick={() => setFull((f) => !f)}>{full ? "Half screen" : "Full screen"}</button>
            <a className="btn sm ghost" href={doc.href} target="_blank" rel="noopener">New tab</a>
            <button type="button" className="iconbtn" aria-label="Close" onClick={() => setDoc(null)}>✕</button>
          </div>
        </div>
        <iframe src={doc.src} title={doc.title} allow="fullscreen" />
      </div>}
    </dialog>
  );
}
