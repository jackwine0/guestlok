import { ArrowRight as LucideArrowRight } from "lucide-react";
const RAYS = Array.from({ length: 28 }, (_, i) => ({
  rotate: `rotate(${((i * 360) / 28).toFixed(2)} 50 50)`,
  delay: `${(i * 0.05).toFixed(2)}s`,
}));

/** The keyhole disc used as the "o" in the wordmark. */
export function KeyholeDisc({
  disc = "currentColor",
  hole = "#F5E7A8",
  className,
  style,
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="48" fill={disc} />
      <circle cx="50" cy="40" r="14" fill={hole} />
      <path d="M43 45 L38 77 L62 77 L57 45 Z" fill={hole} />
    </svg>
  );
}

/** "guestlok" wordmark with the keyhole o. Size it with font-size. */
export function Wordmark({
  className = "",
  hole = "#F5E7A8",
  disc = "currentColor",
}) {
  return (
    <span
      className={`inline-flex items-baseline font-medium tracking-[-0.055em] leading-none ${className}`}
    >
      <span>guestl</span>
      <KeyholeDisc
        disc={disc}
        hole={hole}
        style={{
          width: "0.53em",
          height: "0.53em",
          margin: "0 0.02em",
          transform: "translateY(0.04em)",
        }}
      />
      <span>k</span>
      <span className="sr-only">Guestlok</span>
    </span>
  );
}

/** Sunburst mark — the app icon. Set animated for the roll-call loader. */
export function SunMark({
  size = 120,
  animated = false,
  ray = "#F5E7A8",
  dot = "#2B1B12",
  disc = "#2B1B12",
  hole = "#F5E7A8",
  label,
  className,
}) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 100 100"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {RAYS.map((r) => (
        <g key={r.rotate} transform={r.rotate}>
          <g
            className={animated ? "gl-ray" : undefined}
            style={animated ? { animationDelay: r.delay } : undefined}
          >
            <rect x="47.6" y="5" width="4.8" height="18" rx="1.2" fill={ray} />
            <circle cx="50" cy="9" r="1.3" fill={dot} />
          </g>
        </g>
      ))}
      <g className={animated ? "gl-disc" : undefined}>
        <circle cx="50" cy="50" r="25" fill={disc} />
        <g className={animated ? "gl-key" : undefined}>
          <circle cx="50" cy="45" r="7" fill={hole} />
          <path d="M46.8 48 L44.2 64 L55.8 64 L53.2 48 Z" fill={hole} />
        </g>
      </g>
    </svg>
  );
}

/** Full-area "roll call" loader. */
export function Loader({ label = "Checking the list", fullScreen = false }) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-6 ${fullScreen ? "min-h-dvh bg-ochre" : "py-24"}`}
    >
      <SunMark size={fullScreen ? 180 : 120} animated />
      <p className="text-lg font-medium tracking-tight">
        {label}
        <span className="gl-dot">.</span>
        <span className="gl-dot">.</span>
        <span className="gl-dot">.</span>
      </p>
    </div>
  );
}

/** Small inline spinner for buttons. */
export function ButtonSpinner() {
  return (
    <svg width="22" height="22" viewBox="0 0 100 100" aria-hidden="true">
      {RAYS.map((r) => (
        <g key={r.rotate} transform={r.rotate}>
          <g className="gl-ray" style={{ animationDelay: r.delay }}>
            <rect
              x="46"
              y="4"
              width="8"
              height="20"
              rx="3"
              fill="currentColor"
            />
          </g>
        </g>
      ))}
      <circle cx="50" cy="50" r="24" fill="currentColor" />
    </svg>
  );
}

export function ArrowRight({ size = 16 }) {
  return <LucideArrowRight size={size} strokeWidth={2} aria-hidden="true" />;
}
