/** Static SunSyn music composition built from the SDP-2 palette; no playback claim. */
export function SignalIllustration() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="frequency-ring ring-1" />
      <div className="frequency-ring ring-2" />
      <div className="frequency-ring ring-3" />
      <div className="frequency-ring ring-4" />
      <div className="frequency-core" />
      <div className="frequency-bars">
        {Array.from({ length: 39 }, (_, index) => (
          <i key={index} style={{ height: `${18 + Math.sin(index * 1.7) ** 2 * 62}px` }} />
        ))}
      </div>
      <span className="visual-caption">A DIFFERENT KIND OF SIGNAL</span>
    </div>
  );
}
