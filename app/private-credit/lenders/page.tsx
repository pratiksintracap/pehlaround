import { permanentRedirect } from "next/navigation";

// Retired page of the debt desk: Before the Bell's lending pages are for companies that need to borrow.
export default function Moved() {
  permanentRedirect("/private-credit");
}
