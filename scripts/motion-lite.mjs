// Entry for public/js/motion-lite.js: Motion's small WAAPI animate() plus its spring, as one global (about 5 KB gzipped).
// Rebuild with `npm run build:motion` after upgrading motion.
import { animate } from "motion/mini";
import { spring } from "motion";
window.MotionLite = { animate, spring };
