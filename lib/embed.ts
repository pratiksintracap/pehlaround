// Turning a document link into one that shows inside a side panel.
/** A version of a document link that can be shown in an iframe. Links we cannot convert are returned unchanged. */
export function embeddable(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "drive.google.com") {
      const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? u.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
      const folder = u.pathname.match(/\/drive\/(?:u\/\d+\/)?folders\/([^/?]+)/)?.[1];
      if (folder) return `https://drive.google.com/embeddedfolderview?id=${folder}#grid`;
    }
    if (u.hostname === "docs.google.com") {
      const m = u.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([^/]+)/);
      if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
    }
    return url;
  } catch { return url; }
}
