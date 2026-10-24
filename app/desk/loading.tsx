// Shown while a desk screen loads, so a slow connection looks busy rather than frozen.
export default function Loading() {
  return (
    <div className="dk-skel" aria-busy="true" aria-label="Loading">
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="sk-cards"><div className="sk sk-card" /><div className="sk sk-card" /><div className="sk sk-card" /></div>
      <div className="sk sk-row" /><div className="sk sk-row" /><div className="sk sk-row" /><div className="sk sk-row" />
    </div>
  );
}
