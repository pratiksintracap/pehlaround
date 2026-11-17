"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDealPicture } from "@/lib/deal-picture";

// Card pictures are shown at 400:175. The photo is cropped to that shape from the centre and shrunk in the browser,
// so a phone photo of any size uploads quickly.
const W = 1200, H = 525;
async function toCard(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.max(W / bmp.width, H / bmp.height), sw = W / s, sh = H / s;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d")!; x.imageSmoothingQuality = "high";
  x.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, W, H);
  for (const q of [0.85, 0.75, 0.6]) { const u = c.toDataURL("image/jpeg", q); if (u.length < 880_000) return u; }
  return c.toDataURL("image/jpeg", 0.5);
}

export function DealPictureUpload({ dealId }: { dealId: number }) {
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false); const [preview, setPreview] = useState("");
  const router = useRouter();
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (!/^image\//.test(file.type)) { setMsg("Choose a picture file (JPG, PNG or WebP)."); return; }
    setBusy(true); setMsg("Preparing the picture…");
    try {
      const url = await toCard(file); setPreview(url);
      const r = await uploadDealPicture(dealId, url);
      if ("error" in r) setMsg(r.error);
      else {
        // Point the form's picture choice at "keep", so saving the deal form afterwards doesn't put the old picture back.
        const sel = document.querySelector<HTMLSelectElement>('select[name="artKey"]');
        if (sel) { sel.options[0].text = "Your uploaded picture (keep)"; sel.value = ""; }
        setMsg("Saved. The card on the site now shows this picture."); router.refresh();
      }
    } catch { setMsg("Couldn't read that picture. Try a JPG or PNG."); }
    finally { setBusy(false); e.target.value = ""; }
  }
  return <div style={{ marginTop: 8 }}>
    <label className="btn sm">{busy ? "Uploading…" : "Upload your own picture"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={busy} hidden /></label>
    <span className="fine" style={{ marginLeft: 10 }}>It is cropped to the card shape (wide) from the centre. Use a photo you have the right to use.</span>
    {preview && <figure className="deal-art" style={{ maxWidth: 400, marginTop: 10 }}><img src={preview} alt="" /></figure>}
    {msg && <p className="fine" role="status" style={{ margin: "8px 0 0" }}>{msg}</p>}
  </div>;
}
