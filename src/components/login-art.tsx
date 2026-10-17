"use client";
import { useId, useRef, type CSSProperties, type ReactNode } from "react";

// The open X: four arms that meet around an open centre.
export function XMark({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f07ad6" />
          <stop offset="1" stopColor="#a32688" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c04aa6" />
          <stop offset="1" stopColor="#5b1a50" />
        </linearGradient>
      </defs>
      <g strokeLinecap="round" strokeWidth="19" fill="none">
        <path className="x-arm x-nw" d="M24 24 49 49" stroke={`url(#${id}a)`} />
        <path className="x-arm x-se" d="M71 71 96 96" stroke={`url(#${id}a)`} />
        <path className="x-arm x-ne" d="M96 24 71 49" stroke={`url(#${id}b)`} />
        <path className="x-arm x-sw" d="M49 71 24 96" stroke={`url(#${id}b)`} />
      </g>
    </svg>
  );
}

const floaters: {
  size: number;
  top: number;
  left: number;
  depth: number;
  duration: number;
  delay: number;
  spin: number;
  ghost?: boolean;
}[] = [
  { size: 46, top: 12, left: 14, depth: 2.2, duration: 7, delay: -1, spin: 18 },
  { size: 28, top: 22, left: 78, depth: 3, duration: 6, delay: -3, spin: -24 },
  {
    size: 64,
    top: 66,
    left: 8,
    depth: 1.4,
    duration: 9,
    delay: -5,
    spin: 12,
    ghost: true,
  },
  {
    size: 22,
    top: 80,
    left: 70,
    depth: 3.4,
    duration: 5.5,
    delay: -2,
    spin: 30,
  },
  {
    size: 36,
    top: 48,
    left: 88,
    depth: 2.6,
    duration: 8,
    delay: -6,
    spin: -16,
  },
  {
    size: 18,
    top: 6,
    left: 52,
    depth: 3.8,
    duration: 6.5,
    delay: -4,
    spin: 40,
  },
  {
    size: 90,
    top: 30,
    left: 60,
    depth: 0.8,
    duration: 11,
    delay: -7,
    spin: -8,
    ghost: true,
  },
];

function Floaters({ few = false }: { few?: boolean }) {
  return (
    <>
      {(few ? floaters.slice(0, 5) : floaters).map((f, i) => (
        <span
          key={i}
          className={`float-x${f.ghost ? " ghost" : ""}`}
          style={
            {
              "--size": `${f.size}px`,
              "--top": `${f.top}%`,
              "--left": `${f.left}%`,
              "--depth": f.depth,
              "--duration": `${f.duration}s`,
              "--delay": `${f.delay}s`,
              "--spin": `${f.spin}deg`,
            } as CSSProperties
          }
        >
          <XMark />
        </span>
      ))}
    </>
  );
}

// Soft aurora and drifting X marks behind the whole sign-in page.
export function LoginBackdrop() {
  return (
    <div className="login-backdrop" aria-hidden="true">
      <i className="aurora a1" />
      <i className="aurora a2" />
      <i className="aurora a3" />
      <div className="login-mobile-art">
        <Floaters few />
      </div>
    </div>
  );
}

// Hero stage: the open X at the centre, orbits, floating marks and chips.
// Pointer movement shifts the layers by depth for a light parallax.
export function XStage({ chips }: { chips: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="x-stage"
      aria-hidden="true"
      onPointerMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        ref.current?.style.setProperty(
          "--px",
          ((e.clientX - box.left) / box.width - 0.5).toFixed(3),
        );
        ref.current?.style.setProperty(
          "--py",
          ((e.clientY - box.top) / box.height - 0.5).toFixed(3),
        );
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--px", "0");
        ref.current?.style.setProperty("--py", "0");
      }}
    >
      <Floaters />
      <div className="x-orbit o1">
        <i />
      </div>
      <div className="x-orbit o2">
        <i />
      </div>
      <div className="x-hero">
        <span className="x-glow" />
        <XMark className="x-open" />
      </div>
      {chips.map((chip, i) => (
        <span key={i} className={`x-chip c${i + 1}`}>
          {chip}
        </span>
      ))}
    </div>
  );
}
