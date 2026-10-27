// The deal lifecycle as investors see it (MODEL.md §3). `phase` is the only field that says where a deal is; the
// database computes `published`, `open`, `preview`, `stage` (card tag) and `status` (status line) from it.
// No "server-only" so tests and client components can import it.

export const PHASES = [
  { id: "preparing", label: "In preparation", desk: "Desk only. Nothing about it is on the site.", tag: "In preparation", status: "In preparation" },
  { id: "coming", label: "Coming to the desk", desk: "Shown under Coming to the desk: anonymised title, structure and listing year only.", tag: "Coming to the desk", status: "Being prepared by the desk" },
  { id: "announced", label: "Announced", desk: "On the shelf. Approved investors see the name, round and pitch deck; the NDA cannot be signed yet.", tag: "Room opening soon", status: "Overview live · room opens soon" },
  { id: "open", label: "Room open", desk: "Approved investors can sign the NDA and enter the room.", tag: "Room open", status: "Room open to approved investors" },
  { id: "closed", label: "Round closed", desk: "Still on the shelf as closed. No new NDAs; offices that signed keep the room for updates.", tag: "Round closed", status: "Round closed · updates continue for holders" },
] as const;

export type Phase = (typeof PHASES)[number]["id"];
export const PHASE_IDS = PHASES.map((p) => p.id) as Phase[];
export const isPhase = (v: unknown): v is Phase => typeof v === "string" && (PHASE_IDS as string[]).includes(v);
export const phaseInfo = (p: string | null | undefined) => PHASES.find((x) => x.id === p) ?? PHASES[0];

/** On the public shelf (announced, open or closed). */
export const isPublic = (p: string) => p === "announced" || p === "open" || p === "closed";
/** The NDA can be signed. */
export const roomOpen = (p: string) => p === "open";

/** SQL for the generated columns; the migration and the schema use the same text. */
export const PHASE_SQL = {
  published: `"phase" IN ('announced','open','closed')`,
  open: `"phase" = 'open'`,
  preview: `"phase" = 'coming'`,
  stage: `CASE "phase" ${PHASES.map((p) => `WHEN '${p.id}' THEN '${p.tag}'`).join(" ")} END`,
  status: `CASE "phase" ${PHASES.map((p) => `WHEN '${p.id}' THEN '${p.status}'`).join(" ")} END`,
};
