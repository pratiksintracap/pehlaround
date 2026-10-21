// Runs tests/*.test.ts with Node's test runner. esbuild bundles each test with the "@/..." alias and small stand-ins
// for Next's server modules, so the real lib code (and an in-memory Postgres via PGlite) runs outside Next.
import { build } from "esbuild";
import { readdirSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, ".test-build");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const files = readdirSync(path.join(root, "tests")).filter((f) => f.endsWith(".test.ts"));

const STUBS = {
  "server-only": "export {};",
  "next/cache": "export const unstable_cache = (fn) => fn; export const revalidateTag = () => {}; export const revalidatePath = () => {};",
  "next/headers": "export const cookies = async () => ({ get: () => undefined, set() {}, delete() {} }); export const headers = async () => new Headers();",
  "next/navigation": "export const redirect = (u) => { throw new Error('REDIRECT ' + u); }; export const notFound = () => { throw new Error('NOT_FOUND'); };",
};
const nextStubs = {
  name: "next-stubs",
  setup(b) {
    b.onResolve({ filter: /^(server-only|next\/cache|next\/headers|next\/navigation)$/ }, (a) => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path], loader: "js" }));
    b.onResolve({ filter: /^@\// }, async (a) => b.resolve("./" + a.path.slice(2), { resolveDir: root, kind: a.kind }));
  },
};
await build({
  entryPoints: files.map((f) => path.join(root, "tests", f)), outdir: out, bundle: true, platform: "node", format: "esm", target: "node20",
  packages: "external", plugins: [nextStubs], loader: { ".json": "json" }, sourcemap: "inline", logLevel: "warning", outExtension: { ".js": ".mjs" },
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
const r = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...files.map((f) => path.join(out, f.replace(/\.ts$/, ".mjs")))],
  { stdio: "inherit", cwd: root, env: { ...process.env, PGLITE_DIR: "memory://", DATABASE_URL: "", POSTGRES_URL: "", NODE_ENV: "test" } });
process.exit(r.status ?? 1);
