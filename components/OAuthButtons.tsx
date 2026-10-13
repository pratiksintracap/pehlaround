/** "Continue with Google / Microsoft", shown only for providers switched on in the environment. */
const ICON: Record<string, string> = {
  google: "M12 11v3h5.2c-.6 2.2-2.6 3.8-5.2 3.8a6 6 0 1 1 3.9-10.6l2.1-2.1A9 9 0 1 0 21 12c0-.3 0-.7-.1-1z",
  microsoft: "M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z",
};
export function OAuthButtons({ list, next, verb }: { list: { id: string; name: string }[]; next?: string; verb: string }) {
  if (!list.length) return null;
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="oauth">
      {list.map((p) => (
        <a key={p.id} className="btn oauth-b" href={`/api/auth/oauth/${p.id}${q}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[p.id]} /></svg>{verb} with {p.name}</a>
      ))}
      <span className="oauth-or">or with your email</span>
    </div>
  );
}
