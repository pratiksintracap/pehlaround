import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { getDb } from "@/lib/db";
import { articles } from "@/db/schema";
import { saveArticle } from "@/lib/admin-actions";
import { Msg } from "@/components/AdminBits";

export default async function EditArticle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const me = await requireDesk();
  const { id } = await params;
  const { msg } = await searchParams;
  const db = await getDb();
  const a = id === "new" ? null : (await db.select().from(articles).where(eq(articles.id, Number(id))))[0];
  if (id !== "new" && !a) notFound();
  const date = (a?.publishedAt ?? new Date()).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return (
    <>
      <Msg msg={msg} />
      <p className="crumb"><a href="/admin/articles">← All articles</a>{a && <> · <a href={`/articles/${a.slug}`}>View</a></>}</p>
      <h1 style={{ fontSize: 30, margin: "6px 0 16px" }}>{a ? "Edit article" : "Write an article"}</h1>
      <form action={saveArticle} className="form adm-form">
        <input type="hidden" name="id" value={a?.id ?? 0} />
        <label>Title<input name="title" required defaultValue={a?.title} /></label>
        <label>One-line summary<textarea name="dek" rows={2} defaultValue={a?.dek ?? ""} /></label>
        <div className="row"><label>Web address slug<input name="slug" required defaultValue={a?.slug} placeholder="e.g. october-ipo-calendar" /></label>
          <label>Date<input type="date" name="publishedAt" defaultValue={date} /><span className="hint">A future date schedules it.</span></label></div>
        <div className="row"><label>Author<input name="author" defaultValue={a?.author ?? "Before the Bell team"} /></label>
          <label>Published elsewhere? Link (optional)<input name="externalUrl" defaultValue={a?.externalUrl ?? ""} placeholder="https://…" /></label></div>
        <label>Cover picture (optional link to an image)<input name="image" defaultValue={a?.image ?? ""} placeholder="https://… .jpg or .png" /><span className="hint">Paste any photo link, for example from unsplash.com (free for commercial use). Leave empty and the site picks an editorial photo from the article&apos;s subject.</span></label>
        <label>Article<textarea name="body" rows={22} defaultValue={a?.body ?? ""} /><span className="hint">Leave a blank line between paragraphs. Start a line with ## for a heading and - for a bullet. **bold**, [link text](https://…).</span></label>
        <label>Sources: title | link (one per line)<textarea name="sources" rows={4} defaultValue={(a?.sources ?? []).map((x) => `${x.title} | ${x.url}`).join("\n")} /></label>
        {can(me, "articles.publish") ? <>
        <label className="chk"><input type="checkbox" name="published" defaultChecked={a ? a.published : true} /> Published</label>
        {a && <label className="chk"><input type="checkbox" name="delete" /> Delete this article</label>}
        <div className="adm-save"><button className="btn primary" type="submit">Save article</button></div>
        </> : a?.published ? <p className="notice adm-locked"><b>Live on the site.</b> Only a super admin can change a published article.</p> : <>
        <label className="chk"><input type="checkbox" name="askPublish" /> Ask a super admin to publish it when I save</label>
        <div className="adm-save"><button className="btn primary" type="submit">Save draft</button></div>
        </>}
      </form>
    </>
  );
}
