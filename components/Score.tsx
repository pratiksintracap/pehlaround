import { scoreSvg, SCORE_NOTE } from "@/lib/render";

/** Pehla Score, large: ring plus what the score means. */
export function ScoreBadge({ score, size = "lg", note = true }: { score: number; size?: "lg" | "sm"; note?: boolean }) {
  return (
    <div className={`pscore ${size}`}>
      <span dangerouslySetInnerHTML={{ __html: scoreSvg(score, size === "lg" ? 88 : 44) }} />
      <div><span className="pk">Pehla Score</span><span className="ps"><b>{score.toFixed(1)}</b> / 10</span>
        {note && <p className="fine">{SCORE_NOTE}</p>}</div>
    </div>
  );
}
