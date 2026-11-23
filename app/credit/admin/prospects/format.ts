/** "120.00" -> "120", "87.50" -> "87.5", with Indian digit grouping for large values. */
export function crore(v: string | null | undefined): string {
  if (v == null) return "";
  const n = Number(v);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
