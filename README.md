# Pehla Round (pehlaround.in)

Pre-IPO deal desk for family offices.

**Current state:** this repository holds the static build of the preview (v19, after Puneet's review of 12 Oct 2026). Each page is a self-contained HTML file and can be served as-is by any static host, Vercel included.

- `index.html` and the other pages: the site
- `tools/patch-v19.py`: the script that applied the v19 review changes to the v18 build

**Next step:** rebuild the Next.js source here (the original source was lost) and replace the static pages with it.
