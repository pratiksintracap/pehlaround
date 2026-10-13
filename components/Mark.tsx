import { MARK_SVG } from "@/lib/brand";
export function Mark() {
  return <span className="mk" aria-hidden="true" dangerouslySetInnerHTML={{ __html: MARK_SVG }} />;
}
