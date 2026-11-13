"use client";
import { useEffect } from "react";

// Diagrams below the fold draw in once as they scroll into view. Nothing runs for reduced motion; without JavaScript
// every diagram shows in full.
export function CreditReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add("is-revealed"); io.unobserve(e.target); } }, { threshold: 0.35 });
    document.querySelectorAll(".cr svg.dg:not(.dg-hero), .cr [data-reveal]").forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
      el.classList.add("will-reveal");
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return null;
}
