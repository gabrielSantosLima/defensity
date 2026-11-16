interface AgentMarkProps {
  size?: number;
}

/**
 * Minimal single-colour version of the app mark. Inherits `currentColor`, so the
 * caller decides the neutral tone.
 */
export function AgentMark({ size = 13 }: AgentMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M10 10h44v44H10zM36 36h18v18H36z"
      />
      <rect x="39" y="39" width="12" height="12" fill="currentColor" />
    </svg>
  );
}
