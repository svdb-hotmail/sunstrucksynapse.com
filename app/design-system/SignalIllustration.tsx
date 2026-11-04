/** Static SunSyn music composition built from the SDP-2 palette; no playback claim. */
export function SignalIllustration() {
  return (
    <div className="signal-illustration" aria-hidden="true">
      <div className="signal-illustration__ring" />
      <div className="signal-illustration__ring signal-illustration__ring--outer" />
      <div className="signal-illustration__ring signal-illustration__ring--inner" />
      <div className="signal-illustration__core" />
      <div className="signal-illustration__bars">
        {Array.from({ length: 39 }, (_, index) => (
          <i key={index} style={{ height: `${18 + Math.sin(index * 1.7) ** 2 * 62}px` }} />
        ))}
      </div>
      <span>A different kind of signal</span>
    </div>
  );
}
